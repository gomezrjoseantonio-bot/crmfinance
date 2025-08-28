// Router muy simple + registro de vistas en el menú
import viewHoy from './views/view-hoy.js';
import viewImportar from './views/view-importar.js';
import viewMes from './views/view-mes.js';
import viewInmuebles from './views/view-inmuebles.js';
import viewConfig from './views/view-config.js';

const VIEWS = [viewHoy, viewImportar, viewMes, viewInmuebles, viewConfig];

function currentRoute(){ return location.hash || '#/hoy'; }

async function render(){
  const root = document.getElementById('app');
  if(!root){ console.error('#app no existe'); return; }
  const route = currentRoute();
  const found = VIEWS.find(v => v.route === route) || viewHoy;
  await found.mount(root);
  highlight(route);
}

function buildMenu(){
  const el = document.getElementById('menu');
  if(!el) return;
  el.innerHTML = VIEWS.map(v => `<a href='${v.route}' class='nav' data-route='${v.route}'>${v.title}</a>`).join('');
}

function highlight(route){
  document.querySelectorAll('#menu .nav').forEach(a=>{
    if(a.getAttribute('data-route')===route) a.classList.add('active');
    else a.classList.remove('active');
  });
}

export function mount(){
  buildMenu();
  render();
  window.addEventListener('hashchange', render);
}
