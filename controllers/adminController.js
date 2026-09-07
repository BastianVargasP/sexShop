export const mostrarDashboard = (req, res) => res.render('admin/dashboard', { titulo: 'Dashboard' });
export const mostrarCupones = (req, res) => res.render('admin/cupones', { titulo: 'Cupones' });
export const mostrarClientes = (req, res) => res.render('admin/clientes', { titulo: 'Clientes' });
export const mostrarPedidos = (req, res) => res.render('admin/pedidos', { titulo: 'Gestión de Pedidos' });
export const mostrarInventario = (req, res) => res.render('admin/inventario', { titulo: 'Inventario' });
export const mostrarConfiguracion = (req, res) => res.render('admin/configuracion', { titulo: 'Configuración' });