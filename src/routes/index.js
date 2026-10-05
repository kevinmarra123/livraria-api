import express from "express"
import livros from "./livrosRoutes.js"
import autores from "./autoresRoutes.js"
import rotaNaoEncontrada from "../middlewares/rotaNaoEncontrada.js"
import manipuladorDeErros from "../middlewares/manipuladorDeErros.js"

const routes = (app) => {
    app.use(express.json(), livros, autores)

    app.use(rotaNaoEncontrada)
    app.use(manipuladorDeErros)
}

export default routes
