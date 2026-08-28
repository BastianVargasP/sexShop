export const quiereJson = (req) =>
    req.xhr || (req.headers.accept && req.headers.accept.includes('application/json'));