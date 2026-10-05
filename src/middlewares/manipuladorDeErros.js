import mongoose from "mongoose"
import ErroHttp from "../erros/ErroHttp.js"

// eslint-disable-next-line no-unused-vars
function manipuladorDeErros(erro, req, res, next) {
    if (erro instanceof mongoose.Error.CastError) {
        return res.status(400).json({ mensagem: `Valor inválido para o campo "${erro.path}"` })
    }

    if (erro instanceof mongoose.Error.ValidationError) {
        const erros = Object.values(erro.errors).map((e) => e.message)
        return res.status(400).json({ mensagem: "Dados inválidos", erros })
    }

    if (erro.type === "entity.parse.failed") {
        return res.status(400).json({ mensagem: "O corpo da requisição não é um JSON válido" })
    }

    if (erro instanceof ErroHttp) {
        return res.status(erro.status).json({ mensagem: erro.message })
    }

    console.error(erro)
    res.status(500).json({ mensagem: "Erro interno do servidor" })
}

export default manipuladorDeErros
