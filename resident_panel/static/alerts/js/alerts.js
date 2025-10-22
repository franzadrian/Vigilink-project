document.addEventListener('DOMContentLoaded', function(){
  try {
    // Placeholder for future dynamic fetches (incidents/events)
  } catch (e) {}
});

(function(){
  const btn = document.getElementById('emergency-calls-btn');
  const overlay = document.getElementById('alerts-emerg-overlay');
  const closeBtn = document.getElementById('alerts-emerg-close');
  function open(){ if(overlay){ overlay.style.display='flex'; overlay.classList.add('open'); } }
  function close(){ if(overlay){ overlay.classList.remove('open'); overlay.style.display='none'; } }
  if (btn) btn.addEventListener('click', open);
  if (closeBtn) closeBtn.addEventListener('click', close);
  if (overlay) overlay.addEventListener('click', function(e){ if(e.target===overlay) close(); });
  document.addEventListener('keydown', function(e){ if(e.key==='Escape') close(); });
})();
