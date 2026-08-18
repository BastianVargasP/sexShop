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
    if(!req.session.usuario){
        return next();
    }
    res.redirect('/');
};
