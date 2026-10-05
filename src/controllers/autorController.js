import autor from "../models/Autor.js"
import livro from "../models/Livro.js"
import { NaoEncontrado, Conflito } from "../erros/ErroHttp.js"
import { escaparRegex } from "../utils/paginacao.js"

const CAMPOS_PERMITIDOS = ["nome", "nacionalidade"]

function filtrarCampos(corpo = {}) {
    return Object.fromEntries(
        Object.entries(corpo).filter(([campo]) => CAMPOS_PERMITIDOS.includes(campo))
    )
}

async function contarLivrosPorAutor() {
    const contagens = await livro.aggregate([{ $group: { _id: "$autor", total: { $sum: 1 } } }])
    return new Map(contagens.map((c) => [String(c._id), c.total]))
}

class AutorController {

    static async listarAutores(req, res) {
        const busca = typeof req.query.busca === "string" ? req.query.busca.trim() : ""
        const filtro = busca ? { nome: { $regex: escaparRegex(busca), $options: "i" } } : {}

        const [autores, contagens] = await Promise.all([
            autor.find(filtro).sort({ nome: 1 }).collation({ locale: "pt", strength: 1 }).lean(),
            contarLivrosPorAutor()
        ])

        res.status(200).json(autores.map((a) => ({ ...a, totalLivros: contagens.get(String(a._id)) ?? 0 })))
    }

    static async listarAutorPorId(req, res) {
        const autorEncontrado = await autor.findById(req.params.id).lean()
        if (!autorEncontrado) throw new NaoEncontrado("Autor não encontrado")

        const totalLivros = await livro.countDocuments({ autor: autorEncontrado._id })
        res.status(200).json({ ...autorEncontrado, totalLivros })
    }

    static async cadastrarAutor(req, res) {
        const novoAutor = await autor.create(filtrarCampos(req.body))
        res.status(201).json(novoAutor)
    }

    static async atualizarAutor(req, res) {
        const autorAtualizado = await autor.findByIdAndUpdate(
            req.params.id,
            filtrarCampos(req.body),
            { returnDocument: "after", runValidators: true }
        )
        if (!autorAtualizado) throw new NaoEncontrado("Autor não encontrado")
        res.status(200).json(autorAtualizado)
    }

    static async excluirAutor(req, res) {
        const autorEncontrado = await autor.findById(req.params.id)
        if (!autorEncontrado) throw new NaoEncontrado("Autor não encontrado")

        const totalLivros = await livro.countDocuments({ autor: autorEncontrado._id })
        if (totalLivros > 0) {
            throw new Conflito(`Não é possível excluir: ${autorEncontrado.nome} tem ${totalLivros} livro(s) cadastrado(s)`)
        }

        await autorEncontrado.deleteOne()
        res.status(200).json({ mensagem: "Autor removido com sucesso" })
    }

}

export default AutorController
