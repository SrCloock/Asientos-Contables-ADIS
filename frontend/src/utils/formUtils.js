export const round2 = (value) => {
  if (value === null || value === undefined || isNaN(value)) return 0;
  return Math.round(value * 100) / 100;
};

export const formatFechaForBackend = (fechaString) => {
  if (!fechaString) return '';
  const fecha = new Date(fechaString);
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, '0');
  const day = String(fecha.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const customStyles = {
  control: (base, state) => ({
    ...base,
    border: '1px solid #ccc',
    borderRadius: '4px',
    minHeight: '38px',
    fontSize: '14px',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(0,123,255,0.25)' : 'none',
    borderColor: state.isFocused ? '#80bdff' : '#ccc'
  }),
  menu: (base) => ({ ...base, fontSize: '14px', zIndex: 9999 }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused ? '#e6f3ff' : 'white',
    color: 'black',
    fontSize: '14px',
    cursor: 'pointer'
  }),
  singleValue: (base) => ({ ...base, fontSize: '14px' })
};
