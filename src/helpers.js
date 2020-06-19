function formatNumber(num) {
  return (+num).toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')
}

function shortText(text) {
  const ltext = text.toLowerCase();
  const aliases = {
    'pagar deudas': 'Deudas',
    'gastos familiares': 'Familiar'
  }
  return aliases[ltext] || text;
}

module.exports = {
  formatNumber,
  shortText,
}
