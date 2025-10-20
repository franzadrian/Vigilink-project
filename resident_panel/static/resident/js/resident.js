document.addEventListener('DOMContentLoaded', function() {
  const rowsData = [
    { name: 'Alex Johnson', initials: 'AJ', block: 'B-1', lot: 'L-12' },
    { name: 'Maria Garcia', initials: 'MG', block: 'B-3', lot: 'L-05' },
    { name: 'James Wilson', initials: 'JW', block: 'B-2', lot: 'L-17' },
    { name: 'Sarah Miller', initials: 'SM', block: 'B-4', lot: 'L-03' },
  ];

  const tbody = document.getElementById('resident-table-body');
  const input = document.getElementById('resident-search-input');

  function renderRows(data) {
    if (!tbody) return;
    tbody.innerHTML = '';
    const frag = document.createDocumentFragment();
    data.forEach(r => {
      const tr = document.createElement('tr');
      const colResident = document.createElement('td');
      const colBlockLot = document.createElement('td');
      const colActions = document.createElement('td');
      colActions.className = 'actions-col';

      colResident.innerHTML = `
        <div class="resident-name">
          <span class="avatar">${r.initials}</span>
          <span>${r.name}</span>
        </div>`;
      colBlockLot.textContent = `${r.block}/${r.lot}`;
      colActions.innerHTML = `
        <div class="actions">
          <button class="btn btn-primary" type="button">View</button>
          <button class="btn" type="button">Edit</button>
          <button class="btn btn-danger" type="button">Remove</button>
        </div>`;

      tr.appendChild(colResident);
      tr.appendChild(colBlockLot);
      tr.appendChild(colActions);
      frag.appendChild(tr);
    });
    tbody.appendChild(frag);
  }

  function filter() {
    const q = (input && input.value || '').toLowerCase();
    if (!q) { renderRows(rowsData); return; }
    const filtered = rowsData.filter(r => r.name.toLowerCase().includes(q) || r.block.toLowerCase().includes(q) || r.lot.toLowerCase().includes(q));
    renderRows(filtered);
  }

  if (input) input.addEventListener('input', filter);
  renderRows(rowsData);
});

