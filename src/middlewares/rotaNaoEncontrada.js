import { NaoEncontrado } from "../erros/ErroHttp.js"

function rotaNaoEncontrada(req, res, next) {
    next(new NaoEncontrado(`Rota ${req.method} ${req.originalUrl} não existe`))
}

export default rotaNaoEncontrada
