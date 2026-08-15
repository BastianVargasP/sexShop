import express from 'express';
const router = express.Router();

/* GET home page. */
router.get('/', (req, res, next) => {
  res.render('index', { title: 'Express' });
});

/* GET productos page. */
router.get('/productos', (req, res, next) => {
  res.render('productos', { title: 'Express' });
});

/* GET producto page. */
router.get('/producto', (req, res, next) => {
  res.render('producto', { title: 'Express' });
});


/* GET perfil page. */
router.get('/perfil', (req, res, next) => {
  res.render('perfil', { title: 'Express' });
});

/* GET pedidos page. */
router.get('/pedidos', (req, res, next) => {
  res.render('pedidos', { title: 'Express' });
});

/* GET detalle de pedido page. */
router.get('/pedido', (req, res, next) => {
  res.render('pedido', { title: 'Express' });
});

/* GET direcciones page. */
router.get('/direcciones', (req, res, next) => {
  res.render('direcciones', { title: 'Express' });
});

/* GET direcciones page. */
router.get('/nueva-direccion', (req, res, next) => {
  res.render('nueva-direccion', { title: 'Express' });
});

/* GET lista de deseos page. */
router.get('/favoritos', (req, res, next) => {
  res.render('favoritos', { title: 'Express' });
});

/* GET metodos de pago page. */
router.get('/pagos', (req, res, next) => {
  res.render('pagos', { title: 'Express' });
});

/* GET carrito de compras page. */
router.get('/carrito', (req, res, next) => {
  res.render('carrito', { title: 'Express' });
});

/* GET carrito de compras page. */
router.get('/checkout', (req, res, next) => {
  res.render('checkout', { title: 'Express' });
});



export default router;