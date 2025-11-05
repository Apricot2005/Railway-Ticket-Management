// script.js — RailReserve (client-side railway reservation demo)
// Features: Station & train search, availability mock, coach seat map, fare calc, PNR generation, localStorage tickets

// ---------- Demo Data ----------
const STATIONS = [
  {code:'NDLS', name:'New Delhi'},
  {code:'BCT', name:'Mumbai Central'},
  {code:'HWH', name:'Howrah Jn'},
  {code:'MAS', name:'Chennai Central'},
  {code:'SBC', name:'KSR Bengaluru'},
  {code:'PUNE', name:'Pune Jn'},
  {code:'LKO', name:'Lucknow NR'},
  {code:'CSTM', name:'Mumbai CST'},
];

const TRAINS = [
  { no:'12952', name:'Rajdhani Express', route:['NDLS','BCT'], classes:['2A','3A','SL','CC'], dep:'16:25', arr:'08:15', baseFare:{'CC':950,'SL':540,'3A':1850,'2A':2450} },
  { no:'12261', name:'Duronto Express', route:['NDLS','BCT'], classes:['2A','3A','SL'], dep:'20:50', arr:'11:40', baseFare:{'SL':600,'3A':1900,'2A':2550} },
  { no:'12860', name:'Gitanjali Express', route:['HWH','CSTM'], classes:['SL','3A','2A','CC'], dep:'13:50', arr:'21:30', baseFare:{'CC':900,'SL':500,'3A':1650,'2A':2200} },
  { no:'12610', name:'Navjeevan Express', route:['MAS','ADI'], classes:['SL','3A','2A'], dep:'06:00', arr:'10:00', baseFare:{'SL':480,'3A':1600,'2A':2100} },
  { no:'12627', name:'Karnataka Exp', route:['SBC','NDLS'], classes:['SL','3A','2A'], dep:'19:20', arr:'09:00', baseFare:{'SL':520,'3A':1700,'2A':2300} },
  { no:'11008', name:'Deccan Express', route:['PUNE','CSTM'], classes:['CC','SL','3A'], dep:'07:10', arr:'11:25', baseFare:{'CC':600,'SL':320,'3A':1200} },
];

// ---------- State ----------
const state = {
  from:null, to:null, date:null, cls:'3A', pax:1,
  searchResults:[],
  selection:null, // {train, cls}
  booking:{ train:null, coach:'S1', seats:new Set(), fare:0, pnr:null },
  tickets: JSON.parse(localStorage.getItem('railreserve_tickets')||'[]'),
  occupied: JSON.parse(localStorage.getItem('railreserve_occupied')||'{}'), // key=key(train,cls,date,coach) -> [seatIds]
};

// ---------- Helpers ----------
const qs=(s,e=document)=>e.querySelector(s);
const qsa=(s,e=document)=>[...e.querySelectorAll(s)];
const toast=(t)=>M.toast({html:t, classes:'rounded'});
const money=(n)=>'₹'+n.toLocaleString('en-IN');
const key=(t,cls,date,coach)=> `${t.no}|${cls}|${date}|${coach}`;

function todayISO(){ const d=new Date(); d.setHours(0,0,0,0); return d.toISOString().slice(0,10); }

// ---------- Init UI ----------
function initStations(){
  const list = qs('#stationList');
  list.innerHTML = STATIONS.map(s=>`<option value="${s.code}">${s.name}</option>`).join('');
  qs('#statStations').textContent = STATIONS.length;
  qs('#statTrains').textContent = TRAINS.length;
  qs('#statShows').textContent = 24; // mock
  qs('#journeyDate').value = todayISO();
}

function swapStations(){ const f=qs('#fromStation'), t=qs('#toStation'); [f.value, t.value] = [t.value, f.value]; }

function searchTrains(){
  const from = qs('#fromStation').value.toUpperCase().trim();
  const to   = qs('#toStation').value.toUpperCase().trim();
  const date = qs('#journeyDate').value; if(!from||!to||!date) return toast('Enter From, To and Date');
  const cls  = qs('#journeyClass').value;
  const pax  = Math.max(1, Number(qs('#pax').value)||1);

  const results = TRAINS.filter(tr => tr.route[0]===from && tr.route[tr.route.length-1]===to && tr.classes.includes(cls));
  state.searchResults = results; state.from=from; state.to=to; state.date=date; state.cls=cls; state.pax=pax;
  renderResults();
}

function renderResults(){
  const wrap = qs('#results'); wrap.innerHTML = '';
  if(!state.searchResults.length){ wrap.innerHTML = '<div class="p-4 bg-white border border-slate-200 rounded-xl">No matching trains found.</div>'; return; }
  state.searchResults.forEach(tr=>{
    const avail = mockAvailability(tr, state.cls, state.date);
    const card = document.createElement('div');
    card.className = 'glass-white rounded-2xl border border-slate-200 p-4 shadow-soft flex flex-col';
    card.innerHTML = `
      <div class="flex items-start justify-between gap-2">
        <div>
          <div class="text-lg font-semibold">${tr.no} • ${tr.name}</div>
          <div class="text-slate-600 text-sm">${tr.route[0]} → ${tr.route[tr.route.length-1]} • Dep ${tr.dep} • Arr ${tr.arr}</div>
        </div>
        <div class="text-right">
          <div class="badge">${state.cls}</div>
          <div class="text-sm mt-1">From <b>${money(fareFor(tr,state.cls,state.pax))}</b></div>
        </div>
      </div>
      <div class="mt-3 flex flex-wrap gap-2 text-sm">
        ${avail.coaches.map(c=>`<div class='chip' data-select='{"no":"${tr.no}","cls":"${state.cls}","coach":"${c.coach}"}'>${c.coach}: ${c.left} left</div>`).join('')}
      </div>`;
    wrap.appendChild(card);
  });
  qsa('[data-select]').forEach(ch => ch.addEventListener('click', onSelectCoach));
}

function fareFor(tr, cls, pax){
  const base = tr.baseFare[cls]||1000; const conv = Math.round(base*0.05); return (base+conv)*Math.max(1,pax);
}

function mockAvailability(tr, cls, date){
  // produce 3 coaches with pseudo-random left seats
  const rng = seededRandom(tr.no+cls+date);
  const coaches = ['S1','S2','S3'].map((c,i)=>({ coach:c, left: 30 + Math.floor(rng()*50) }));
  return { coaches };
}

function seededRandom(seed){
  // tiny LCG
  let h=0; for(let i=0;i<seed.length;i++) h = (h*31 + seed.charCodeAt(i))>>>0;
  return function(){ h = (1103515245*h + 12345) % 2**31; return (h/2**31); };
}

// ---------- Booking & Seats ----------
const PRICE_BY_CLASS = { 'SL': 540, '3A': 1850, '2A': 2450, 'CC': 950 };

function onSelectCoach(e){
  const data = JSON.parse(e.currentTarget.dataset.select);
  const tr = TRAINS.find(t=>t.no===data.no);
  state.selection = { train:tr, cls:data.cls, coach:data.coach };
  state.booking = { train:tr, coach:data.coach, seats:new Set(), fare:0, pnr:null };
  toast(`Selected ${tr.no} ${tr.name} — ${data.cls} • Coach ${data.coach}`);
  buildSeatMap();
  updateSummary();
  location.hash = '#booking';
}

function buildSeatMap(){
  const map = qs('#seatMap'); map.innerHTML='';
  const rows = 'ABCDEFGHIJ'.split(''); const cols = 18; // 10x18 with aisles at 5 and 15
  const occ = occupiedSetForCurrent();
  rows.forEach((row)=>{
    for(let c=1;c<=cols;c++){
      if(c===5||c===15){ const sp=document.createElement('div'); map.appendChild(sp); continue; }
      const id = `${row}${c}`;
      const b = document.createElement('button');
      b.className = 'seat aspect-square text-xs flex items-center justify-center rounded-lg bg-white border border-slate-200 hover:border-sky-400';
      b.textContent = id; b.dataset.id=id; b.dataset.price = PRICE_BY_CLASS[state.selection.cls]||1000;
      if(occ.has(id)){ b.classList.add('unavailable'); b.disabled=true; }
      b.addEventListener('click', ()=>toggleSeat(b));
      map.appendChild(b);
    }
  });
}

function occupiedSetForCurrent(){
  const s = state.selection; if(!s) return new Set();
  const k = key(s.train, s.cls, state.date, s.coach);
  return new Set(state.occupied[k]||[]);
}

function toggleSeat(btn){
  const set = state.booking.seats; const id = btn.dataset.id;
  if(btn.classList.contains('selected')){
    set.delete(id); btn.classList.remove('selected','bg-sky-100','border-sky-400'); btn.classList.add('bg-white','border-slate-200');
  } else {
    if(set.size >= Number(qs('#pax').value||1)) return toast('Seat count equals passenger count');
    set.add(id); btn.classList.add('selected','bg-sky-100','border-sky-400'); btn.classList.remove('bg-white','border-slate-200');
  }
  updateSummary();
}

function updateSummary(){
  const s = state.selection; if(!s) return;
  const seats = [...state.booking.seats];
  const base = PRICE_BY_CLASS[s.cls]||1000; const conv = Math.round(base*0.05);
  const total = seats.length * (base+conv);
  qs('#sumTrain').textContent = `${s.train.no} ${s.train.name}`;
  qs('#sumRoute').textContent = `${state.from} → ${state.to}`;
  qs('#sumClass').textContent = `${s.cls} • ${s.coach}`;
  qs('#sumDate').textContent = state.date;
  qs('#sumTotal').textContent = money(total);
  qs('#checkoutBtn').disabled = seats.length!==Math.max(1, Number(qs('#pax').value)||1);
}

function initCheckout(){
  const modal = M.Modal.init(document.getElementById('checkoutModal'));
  qs('#checkoutBtn').addEventListener('click', ()=>{
    const s = state.selection; const seats=[...state.booking.seats];
    if(qs('#checkoutBtn').disabled) return;
    qs('#modalText').textContent = `${s.train.no} ${s.train.name} • ${state.from}→${state.to} • ${state.date} • ${s.cls} ${s.coach} • Seats: ${seats.join(', ')}`;
    modal.open();
  });
  qs('#payNow').addEventListener('click', confirmPayment);
}

function confirmPayment(){
  const s = state.selection; const seats=[...state.booking.seats]; if(!s||!seats.length) return;
  const pnr = genPNR();
  // mark occupied
  const k = key(s.train, s.cls, state.date, s.coach);
  const arr = state.occupied[k]||[]; seats.forEach(x=>{ if(!arr.includes(x)) arr.push(x); }); state.occupied[k]=arr;
  localStorage.setItem('railreserve_occupied', JSON.stringify(state.occupied));
  // save ticket
  const base = PRICE_BY_CLASS[s.cls]||1000; const conv = Math.round(base*0.05); const amount = seats.length*(base+conv);
  const ticket = { pnr, trainNo:s.train.no, trainName:s.train.name, from:state.from, to:state.to, date:state.date, cls:s.cls, coach:s.coach, seats, amount, bookedAt:new Date().toISOString() };
  state.tickets.unshift(ticket);
  localStorage.setItem('railreserve_tickets', JSON.stringify(state.tickets));
  renderTickets();
  toast('Payment successful. PNR: '+pnr);
  // lock seats in UI
  seats.forEach(id=>{
    const el = qs(`[data-id="${id}"]`); if(el){ el.classList.add('unavailable'); el.disabled=true; el.classList.remove('selected'); }
  });
  state.booking.seats.clear();
  updateSummary();
}

function genPNR(){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s=''; for(let i=0;i<8;i++) s+=chars[Math.floor(Math.random()*chars.length)];
  return s;
}

// ---------- Tickets ----------
function renderTickets(){
  const wrap = qs('#ticketList'); wrap.innerHTML='';
  if(!state.tickets.length){ wrap.innerHTML = '<div class="p-4 bg-white border border-slate-200 rounded-xl">No tickets yet.</div>'; return; }
  state.tickets.forEach(t=>{
    const card = document.createElement('div'); card.className='ticket-card';
    card.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="font-semibold">${t.trainNo} • ${t.trainName}</div>
        <div class="badge">PNR ${t.pnr}</div>
      </div>
      <div class="text-slate-700 text-sm mt-1">${t.from} → ${t.to} • ${t.date} • ${t.cls} ${t.coach} • Seats: ${t.seats.join(', ')}</div>
      <div class="mt-2 flex items-center justify-between text-sm">
        <div>Amount: <b>${money(t.amount)}</b></div>
        <div class="text-slate-500">Booked: ${new Date(t.bookedAt).toLocaleString()}</div>
      </div>`;
    wrap.appendChild(card);
  });
}

// ---------- Wire Up ----------
window.addEventListener('DOMContentLoaded', ()=>{
  M.Modal.init(qs('#checkoutModal'));
  initStations();
  renderTickets();

  qs('#swapBtn').addEventListener('click', swapStations);
  qs('#searchBtn').addEventListener('click', searchTrains);
  qs('#journeyClass').addEventListener('change', ()=>{ if(state.searchResults.length) renderResults(); });
  qs('#pax').addEventListener('input', updateSummary);
  initCheckout();
});
