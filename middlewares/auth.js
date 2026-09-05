export const estaAutenticado = (req, res, next) => {
    if (req.session.usuario) {
        return next();
    }

    const esPeticionJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));
    if (esPeticionJson) {
        return res.status(401).json({ ok: false, error: 'Debes iniciar sesión para continuar.' });
    }

    return res.redirect('/auth/login');
};

export const esInvitado = (req, res, next) => {
    if (!req.session.usuario) {
        return next();
    }
    res.redirect(req.session.usuario.rol === 'admin' ? '/admin' : '/');
};

// Solo deja pasar si la sesión existe Y su rol guardado en base de datos/sesión es 'admin'
export const esAdmin = (req, res, next) => {
    if (req.session.usuario && req.session.usuario.rol === 'admin') {
        return next();
    }

    const esPeticionJson = req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));
    if (esPeticionJson) {
        return res.status(403).json({ ok: false, error: 'No tienes permisos para acceder a este recurso.' });
    }

    return res.status(403).render('error', {
        ok: false,
        mensaje: 'No tienes permisos para acceder a esta sección.',
        error: { status: 403, stack: 'Acceso restringido a administradores.' }
    });
};