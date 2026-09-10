export const mostrarDashboard = (req, res) => res.render('admin/dashboard', { titulo: 'Dashboard' });
export const mostrarClientes = (req, res) => res.render('admin/clientes', { titulo: 'Clientes' });
export const mostrarConfiguracion = (req, res) => res.render('admin/configuracion', { titulo: 'Configuración' });