export const estaAutenticado = (req, res, next) => {
    if(req.session.usuario){
        return next();
    }
    return res.redirect('/auth/login');
};

export const esInvitado = (req, res, next) => {
    if(!req.session.usuario){
        return next();
    }
    res.redirect('/');
};