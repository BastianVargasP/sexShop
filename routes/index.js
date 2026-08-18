import express from 'express';
import { getDbClient } from '../helpers/database.js';
import { registrarActividad } from '../helpers/logger.js';
import { estaAutenticado } from '../middlewares/auth.js';

const router = express.Router();

const quiereJson = (req) =>
  req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));

router.get('/', (req, res) => {
  res.render('index', { title: 'Express' });
});

/* ==================== Catálogo de productos ==================== */
router.get('/productos', async (req, res, next) => {
  const conexion = getDbClient();
  try {
    await conexion.connect();

    const resultado = await conexion.query(
      'SELECT * FROM productos ORDER BY destacado DESC, created_at DESC'
    );

    let favoritosIds = new Set();
    if (req.session.usuario) {
      const favResult = await conexion.query(
        'SELECT producto_id FROM favoritos WHERE cliente_id = $1',
        [req.session.usuario.id]
      );
      favoritosIds = new Set(favResult.rows.map((r) => r.producto_id));
    }

    res.render('productos', {
      title: 'Productos',
      productos: resultado.rows,
      favoritosIds
    });
  } catch (error) {
    registrarActividad(`❌ GET /productos - ERROR: ${error.message}`);
    next(error);
  } finally {
    await conexion.end();
  }
});

router.get('/producto/:id', async (req, res, next) => {
  const conexion = getDbClient();
  try {
    await conexion.connect();

    const resultado = await conexion.query('SELECT * FROM productos WHERE id = $1', [req.params.id]);
    if (resultado.rows.length === 0) {
      return next(); // producto inexistente -> 404
    }

    const producto = resultado.rows[0];

    const relacionadosResult = await conexion.query(
      `SELECT * FROM productos
       WHERE categoria = $1 AND id != $2
       ORDER BY destacado DESC, created_at DESC
       LIMIT 3`,
      [producto.categoria, producto.id]
    );

    let favoritosIds = new Set();
    if (req.session.usuario) {
      const favResult = await conexion.query(
        'SELECT producto_id FROM favoritos WHERE cliente_id = $1',
        [req.session.usuario.id]
      );
      favoritosIds = new Set(favResult.rows.map((r) => r.producto_id));
    }

    res.render('producto', {
      title: producto.nombre,
      producto,
      esFavorito: favoritosIds.has(producto.id),
      relacionados: relacionadosResult.rows,
      favoritosIds
    });
  } catch (error) {
    registrarActividad(`❌ GET /producto/${req.params.id} - ERROR: ${error.message}`);
    next(error);
  } finally {
    await conexion.end();
  }
});

router.post('/productos/:id/favorito', estaAutenticado, async (req, res, next) => {
  const conexion = getDbClient();
  try {
    await conexion.connect();
    await conexion.query(
      `INSERT INTO favoritos (cliente_id, producto_id)
       VALUES ($1, $2)
       ON CONFLICT (cliente_id, producto_id) DO NOTHING`,
      [req.session.usuario.id, req.params.id]
    );

    registrarActividad(`❤️ POST /productos/${req.params.id}/favorito - ÉXITO: cliente #${req.session.usuario.id}.`);

    if (quiereJson(req)) {
      return res.json({ ok: true, favorito: true });
    }
    res.redirect(req.get('Referrer') || '/productos');
  } catch (error) {
    registrarActividad(`❤️❌ POST /productos/${req.params.id}/favorito - ERROR: ${error.message}`);
    if (quiereJson(req)) {
      return res.status(500).json({ ok: false, error: 'No se pudo guardar el favorito.' });
    }
    next(error);
  } finally {
    await conexion.end();
  }
});

router.post('/productos/:id/quitar-favorito', estaAutenticado, async (req, res, next) => {
  const conexion = getDbClient();
  try {
    await conexion.connect();
    await conexion.query(
      'DELETE FROM favoritos WHERE cliente_id = $1 AND producto_id = $2',
      [req.session.usuario.id, req.params.id]
    );

    registrarActividad(`❤️ POST /productos/${req.params.id}/quitar-favorito - ÉXITO: cliente #${req.session.usuario.id}.`);

    if (quiereJson(req)) {
      return res.json({ ok: true, favorito: false });
    }
    res.redirect(req.get('Referrer') || '/productos');
  } catch (error) {
    registrarActividad(`❤️❌ POST /productos/${req.params.id}/quitar-favorito - ERROR: ${error.message}`);
    if (quiereJson(req)) {
      return res.status(500).json({ ok: false, error: 'No se pudo quitar el favorito.' });
    }
    next(error);
  } finally {
    await conexion.end();
  }
});

/* ==================== Mis datos ==================== */
router.get('/perfil', estaAutenticado, async (req, res, next) => {
  const conexion = getDbClient();
  try {
    await conexion.connect();
    const resultado = await conexion.query(
      'SELECT id, nombre, apellido, email, telefono FROM clientes WHERE id = $1',
      [req.session.usuario.id]
    );

    if (resultado.rows.length === 0) {
      return req.session.destroy(() => res.redirect('/auth/login'));
    }

    res.render('perfil', { title: 'Mis datos', cliente: resultado.rows[0] });
  } catch (error) {
    registrarActividad(`❌ GET /perfil - ERROR: ${error.message}`);
    next(error);
  } finally {
    await conexion.end();
  }
});

router.post('/perfil', estaAutenticado, async (req, res, next) => {
  const conexion = getDbClient();
  try {
    const { firstName, lastName, phone } = req.body;

    if (!firstName || !lastName) {
      return res.status(400).render('error', {
        ok: false,
        mensaje: 'Nombre y apellido son obligatorios.',
        error: { status: 400, stack: 'Revisa el formulario e intenta nuevamente.' }
      });
    }

    await conexion.connect();
    await conexion.query(
      'UPDATE clientes SET nombre = $1, apellido = $2, telefono = $3 WHERE id = $4',
      [firstName, lastName, phone, req.session.usuario.id]
    );

    req.session.usuario.nombre = firstName;
    req.session.usuario.apellido = lastName;

    registrarActividad(`👤 POST /perfil - ÉXITO: Datos actualizados (cliente #${req.session.usuario.id}).`);
    res.redirect('/perfil');
  } catch (error) {
    registrarActividad(`👤❌ POST /perfil - ERROR: ${error.message}`);
    next(error);
  } finally {
    await conexion.end();
  }
});

/* ==================== Pedidos ==================== */
router.get('/pedidos', estaAutenticado, async (req, res, next) => {
  const conexion = getDbClient();
  try {
    await conexion.connect();
    const resultado = await conexion.query(
      `SELECT id, numero_pedido, estado, total, created_at
       FROM pedidos WHERE cliente_id = $1 ORDER BY created_at DESC`,
      [req.session.usuario.id]
    );

    res.render('pedidos', { title: 'Mis pedidos', pedidos: resultado.rows });
  } catch (error) {
    registrarActividad(`❌ GET /pedidos - ERROR: ${error.message}`);
    next(error);
  } finally {
    await conexion.end();
  }
});

router.get('/pedido/:id', estaAutenticado, async (req, res, next) => {
  const conexion = getDbClient();
  try {
    await conexion.connect();

    const pedidoResult = await conexion.query(
      `SELECT p.*, d.direccion, d.ciudad, d.codigo_postal, d.comuna, d.region,
              m.marca, m.ultimos_digitos
       FROM pedidos p
       LEFT JOIN direcciones d ON d.id = p.direccion_id
       LEFT JOIN metodos_pago m ON m.id = p.metodo_pago_id
       WHERE p.id = $1 AND p.cliente_id = $2`,
      [req.params.id, req.session.usuario.id]
    );

    if (pedidoResult.rows.length === 0) {
      return next();
    }

    const itemsResult = await conexion.query(
      'SELECT * FROM pedido_items WHERE pedido_id = $1',
      [req.params.id]
    );

    const pasosPorEstado = { procesando: 2, enviado: 3, entregado: 4, devuelto: 4 };

    res.render('pedido', {
      title: 'Detalle del pedido',
      pedido: pedidoResult.rows[0],
      items: itemsResult.rows,
      pasoActual: pasosPorEstado[pedidoResult.rows[0].estado] || 1
    });
  } catch (error) {
    registrarActividad(`❌ GET /pedido/${req.params.id} - ERROR: ${error.message}`);
    next(error);
  } finally {
    await conexion.end();
  }
});

/* ==================== Direcciones ==================== */
router.get('/direcciones', estaAutenticado, async (req, res, next) => {
  const conexion = getDbClient();
  try {
    await conexion.connect();
    const resultado = await conexion.query(
      'SELECT * FROM direcciones WHERE cliente_id = $1 ORDER BY predeterminada DESC, created_at DESC',
      [req.session.usuario.id]
    );

    res.render('direcciones', { title: 'Mis direcciones', direcciones: resultado.rows });
  } catch (error) {
    registrarActividad(`❌ GET /direcciones - ERROR: ${error.message}`);
    next(error);
  } finally {
    await conexion.end();
  }
});

router.get('/nueva-direccion', estaAutenticado, (req, res) => {
  res.render('nueva-direccion', { title: 'Nueva dirección' });
});

router.post('/nueva-direccion', estaAutenticado, async (req, res, next) => {
  const conexion = getDbClient();
  try {
    const { etiqueta, address, city, postalCode, province, country, phone, defaultAddress } = req.body;

    if (!address || !city) {
      return res.status(400).render('error', {
        ok: false,
        mensaje: 'La dirección y la ciudad son obligatorias.',
        error: { status: 400, stack: 'Revisa el formulario e intenta nuevamente.' }
      });
    }

    await conexion.connect();

    if (defaultAddress) {
      await conexion.query(
        'UPDATE direcciones SET predeterminada = FALSE WHERE cliente_id = $1',
        [req.session.usuario.id]
      );
    }

    await conexion.query(
      `INSERT INTO direcciones (cliente_id, etiqueta, direccion, ciudad, codigo_postal, comuna, region, telefono, predeterminada)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [req.session.usuario.id, etiqueta || 'Dirección', address, city, postalCode, province, country, phone, !!defaultAddress]
    );

    registrarActividad(`📍 POST /nueva-direccion - ÉXITO: cliente #${req.session.usuario.id}.`);
    res.redirect('/direcciones');
  } catch (error) {
    registrarActividad(`📍❌ POST /nueva-direccion - ERROR: ${error.message}`);
    next(error);
  } finally {
    await conexion.end();
  }
});

router.get('/direcciones/:id/editar', estaAutenticado, async (req, res, next) => {
  const conexion = getDbClient();
  try {
    await conexion.connect();
    const resultado = await conexion.query(
      'SELECT * FROM direcciones WHERE id = $1 AND cliente_id = $2',
      [req.params.id, req.session.usuario.id]
    );

    if (resultado.rows.length === 0) {
      return next();
    }

    res.render('editar-direccion', { title: 'Editar dirección', direccion: resultado.rows[0] });
  } catch (error) {
    registrarActividad(`❌ GET /direcciones/${req.params.id}/editar - ERROR: ${error.message}`);
    next(error);
  } finally {
    await conexion.end();
  }
});

router.post('/direcciones/:id/editar', estaAutenticado, async (req, res, next) => {
  const conexion = getDbClient();
  try {
    const { etiqueta, address, city, postalCode, province, country, phone, defaultAddress } = req.body;

    if (!address || !city) {
      return res.status(400).render('error', {
        ok: false,
        mensaje: 'La dirección y la ciudad son obligatorias.',
        error: { status: 400, stack: 'Revisa el formulario e intenta nuevamente.' }
      });
    }

    await conexion.connect();

    const propietaria = await conexion.query(
      'SELECT id FROM direcciones WHERE id = $1 AND cliente_id = $2',
      [req.params.id, req.session.usuario.id]
    );
    if (propietaria.rows.length === 0) {
      return next();
    }

    if (defaultAddress) {
      await conexion.query(
        'UPDATE direcciones SET predeterminada = FALSE WHERE cliente_id = $1',
        [req.session.usuario.id]
      );
    }

    await conexion.query(
      `UPDATE direcciones
       SET etiqueta = $1, direccion = $2, ciudad = $3, codigo_postal = $4, comuna = $5, region = $6, telefono = $7, predeterminada = $8
       WHERE id = $9 AND cliente_id = $10`,
      [etiqueta || 'Dirección', address, city, postalCode, province, country, phone, !!defaultAddress, req.params.id, req.session.usuario.id]
    );

    registrarActividad(`📍 POST /direcciones/${req.params.id}/editar - ÉXITO.`);
    res.redirect('/direcciones');
  } catch (error) {
    registrarActividad(`📍❌ POST /direcciones/${req.params.id}/editar - ERROR: ${error.message}`);
    next(error);
  } finally {
    await conexion.end();
  }
});

router.post('/direcciones/:id/eliminar', estaAutenticado, async (req, res, next) => {
  const conexion = getDbClient();
  try {
    await conexion.connect();
    const resultado = await conexion.query(
      'DELETE FROM direcciones WHERE id = $1 AND cliente_id = $2 RETURNING id',
      [req.params.id, req.session.usuario.id]
    );

    if (resultado.rows.length === 0) {
      return next();
    }

    registrarActividad(`📍 POST /direcciones/${req.params.id}/eliminar - ÉXITO.`);
    res.redirect('/direcciones');
  } catch (error) {
    registrarActividad(`📍❌ POST /direcciones/${req.params.id}/eliminar - ERROR: ${error.message}`);
    next(error);
  } finally {
    await conexion.end();
  }
});

router.post('/direcciones/:id/predeterminada', estaAutenticado, async (req, res, next) => {
  const conexion = getDbClient();
  try {
    await conexion.connect();

    const propietaria = await conexion.query(
      'SELECT id FROM direcciones WHERE id = $1 AND cliente_id = $2',
      [req.params.id, req.session.usuario.id]
    );
    if (propietaria.rows.length === 0) {
      return next();
    }

    await conexion.query('UPDATE direcciones SET predeterminada = FALSE WHERE cliente_id = $1', [req.session.usuario.id]);
    await conexion.query('UPDATE direcciones SET predeterminada = TRUE WHERE id = $1', [req.params.id]);

    registrarActividad(`📍 POST /direcciones/${req.params.id}/predeterminada - ÉXITO.`);
    res.redirect('/direcciones');
  } catch (error) {
    registrarActividad(`📍❌ POST /direcciones/${req.params.id}/predeterminada - ERROR: ${error.message}`);
    next(error);
  } finally {
    await conexion.end();
  }
});

/* ==================== Favoritos ==================== */
router.get('/favoritos', estaAutenticado, async (req, res, next) => {
  const conexion = getDbClient();
  try {
    await conexion.connect();
    const resultado = await conexion.query(
      `SELECT f.id, f.producto_id,
              p.nombre AS producto_nombre,
              p.descripcion_corta AS producto_descripcion,
              p.imagen AS producto_imagen,
              p.precio,
              p.etiqueta
       FROM favoritos f
       JOIN productos p ON p.id = f.producto_id
       WHERE f.cliente_id = $1
       ORDER BY f.created_at DESC`,
      [req.session.usuario.id]
    );

    res.render('favoritos', { title: 'Lista de deseos', favoritos: resultado.rows });
  } catch (error) {
    registrarActividad(`❌ GET /favoritos - ERROR: ${error.message}`);
    next(error);
  } finally {
    await conexion.end();
  }
});

/* ==================== Métodos de pago ==================== */
router.get('/pagos', estaAutenticado, async (req, res, next) => {
  const conexion = getDbClient();
  try {
    await conexion.connect();
    const resultado = await conexion.query(
      'SELECT * FROM metodos_pago WHERE cliente_id = $1 ORDER BY predeterminada DESC, created_at DESC',
      [req.session.usuario.id]
    );

    res.render('pagos', { title: 'Métodos de pago', metodosPago: resultado.rows });
  } catch (error) {
    registrarActividad(`❌ GET /pagos - ERROR: ${error.message}`);
    next(error);
  } finally {
    await conexion.end();
  }
});

router.get('/nuevo-metodo-pago', estaAutenticado, (req, res) => {
  res.render('nuevo-metodo-pago', { title: 'Nuevo método de pago' });
});

router.post('/nuevo-metodo-pago', estaAutenticado, async (req, res, next) => {
  const conexion = getDbClient();
  try {
    const { marca, numeroTarjeta, vencimiento, titular, defaultMetodo } = req.body;

    if (!marca || !numeroTarjeta || !vencimiento || !titular) {
      return res.status(400).render('error', {
        ok: false,
        mensaje: 'Todos los campos son obligatorios.',
        error: { status: 400, stack: 'Revisa el formulario e intenta nuevamente.' }
      });
    }

    const soloDigitos = numeroTarjeta.replace(/\D/g, '');
    if (soloDigitos.length < 4) {
      return res.status(400).render('error', {
        ok: false,
        mensaje: 'El número de tarjeta ingresado no es válido.',
        error: { status: 400, stack: 'Revisa el número e intenta nuevamente.' }
      });
    }
    const ultimosDigitos = soloDigitos.slice(-4);

    await conexion.connect();

    if (defaultMetodo) {
      await conexion.query('UPDATE metodos_pago SET predeterminada = FALSE WHERE cliente_id = $1', [req.session.usuario.id]);
    }

    await conexion.query(
      `INSERT INTO metodos_pago (cliente_id, marca, ultimos_digitos, vencimiento, titular, predeterminada)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [req.session.usuario.id, marca, ultimosDigitos, vencimiento, titular, !!defaultMetodo]
    );

    registrarActividad(`💳 POST /nuevo-metodo-pago - ÉXITO: cliente #${req.session.usuario.id}.`);
    res.redirect('/pagos');
  } catch (error) {
    registrarActividad(`💳❌ POST /nuevo-metodo-pago - ERROR: ${error.message}`);
    next(error);
  } finally {
    await conexion.end();
  }
});

router.get('/pagos/:id/editar', estaAutenticado, async (req, res, next) => {
  const conexion = getDbClient();
  try {
    await conexion.connect();
    const resultado = await conexion.query(
      'SELECT * FROM metodos_pago WHERE id = $1 AND cliente_id = $2',
      [req.params.id, req.session.usuario.id]
    );

    if (resultado.rows.length === 0) {
      return next();
    }

    res.render('editar-metodo-pago', { title: 'Editar método de pago', metodo: resultado.rows[0] });
  } catch (error) {
    registrarActividad(`❌ GET /pagos/${req.params.id}/editar - ERROR: ${error.message}`);
    next(error);
  } finally {
    await conexion.end();
  }
});

router.post('/pagos/:id/editar', estaAutenticado, async (req, res, next) => {
  const conexion = getDbClient();
  try {
    const { marca, vencimiento, titular, defaultMetodo } = req.body;

    if (!marca || !vencimiento || !titular) {
      return res.status(400).render('error', {
        ok: false,
        mensaje: 'Todos los campos son obligatorios.',
        error: { status: 400, stack: 'Revisa el formulario e intenta nuevamente.' }
      });
    }

    await conexion.connect();

    const propietario = await conexion.query(
      'SELECT id FROM metodos_pago WHERE id = $1 AND cliente_id = $2',
      [req.params.id, req.session.usuario.id]
    );
    if (propietario.rows.length === 0) {
      return next();
    }

    if (defaultMetodo) {
      await conexion.query('UPDATE metodos_pago SET predeterminada = FALSE WHERE cliente_id = $1', [req.session.usuario.id]);
    }

    await conexion.query(
      `UPDATE metodos_pago SET marca = $1, vencimiento = $2, titular = $3, predeterminada = $4
       WHERE id = $5 AND cliente_id = $6`,
      [marca, vencimiento, titular, !!defaultMetodo, req.params.id, req.session.usuario.id]
    );

    registrarActividad(`💳 POST /pagos/${req.params.id}/editar - ÉXITO.`);
    res.redirect('/pagos');
  } catch (error) {
    registrarActividad(`💳❌ POST /pagos/${req.params.id}/editar - ERROR: ${error.message}`);
    next(error);
  } finally {
    await conexion.end();
  }
});

router.post('/pagos/:id/eliminar', estaAutenticado, async (req, res, next) => {
  const conexion = getDbClient();
  try {
    await conexion.connect();
    const resultado = await conexion.query(
      'DELETE FROM metodos_pago WHERE id = $1 AND cliente_id = $2 RETURNING id',
      [req.params.id, req.session.usuario.id]
    );

    if (resultado.rows.length === 0) {
      return next();
    }

    registrarActividad(`💳 POST /pagos/${req.params.id}/eliminar - ÉXITO.`);
    res.redirect('/pagos');
  } catch (error) {
    registrarActividad(`💳❌ POST /pagos/${req.params.id}/eliminar - ERROR: ${error.message}`);
    next(error);
  } finally {
    await conexion.end();
  }
});

router.post('/pagos/:id/predeterminada', estaAutenticado, async (req, res, next) => {
  const conexion = getDbClient();
  try {
    await conexion.connect();

    const propietario = await conexion.query(
      'SELECT id FROM metodos_pago WHERE id = $1 AND cliente_id = $2',
      [req.params.id, req.session.usuario.id]
    );
    if (propietario.rows.length === 0) {
      return next();
    }

    await conexion.query('UPDATE metodos_pago SET predeterminada = FALSE WHERE cliente_id = $1', [req.session.usuario.id]);
    await conexion.query('UPDATE metodos_pago SET predeterminada = TRUE WHERE id = $1', [req.params.id]);

    registrarActividad(`💳 POST /pagos/${req.params.id}/predeterminada - ÉXITO.`);
    res.redirect('/pagos');
  } catch (error) {
    registrarActividad(`💳❌ POST /pagos/${req.params.id}/predeterminada - ERROR: ${error.message}`);
    next(error);
  } finally {
    await conexion.end();
  }
});

router.get('/carrito', (req, res) => {
  res.render('carrito', { title: 'Express' });
});

router.get('/checkout', (req, res) => {
  res.render('checkout', { title: 'Express' });
});

export default router;
