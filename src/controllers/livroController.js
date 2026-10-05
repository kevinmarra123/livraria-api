import livro from "../models/Livro.js"
import autor from "../models/Autor.js"
import { NaoEncontrado, RequisicaoIncorreta } from "../erros/ErroHttp.js"
import { lerPaginacao, montarRespostaPaginada, escaparRegex } from "../utils/paginacao.js"

const CAMPOS_PERMITIDOS = ["titulo", "autor", "editora", "preco", "paginas"]

const ORDENACOES = {
    recentes: { createdAt: -1 },
    titulo: { titulo: 1 },
    "preco-asc": { preco: 1 },
    "preco-desc": { preco: -1 }
}

const DADOS_DO_AUTOR = "nome nacionalidade"

function filtrarCampos(corpo = {}) {
    return Object.fromEntries(
        Object.entries(corpo).filter(([campo]) => CAMPOS_PERMITIDOS.includes(campo))
    )
}

function lerTexto(valor) {
    return typeof valor === "string" ? valor.trim() : ""
}

async function garantirQueAutorExiste(autorId) {
    if (autorId === undefined || autorId === null || autorId === "") return
    const existe = await autor.exists({ _id: autorId })
    if (!existe) throw new RequisicaoIncorreta("O autor informado não existe")
}

class LivroController {

    static async listarLivros(req, res) {
        const { pagina, limite, pular } = lerPaginacao(req.query)
        const busca = lerTexto(req.query.busca)
        const autorId = lerTexto(req.query.autor)
        const ordenacao = lerTexto(req.query.ordenacao) || "recentes"

        const ordem = ORDENACOES[ordenacao]
        if (!ordem) {
            throw new RequisicaoIncorreta(`Ordenação inválida. Use: ${Object.keys(ORDENACOES).join(", ")}`)
        }

        const filtro = {}
        if (busca) {
            const regex = { $regex: escaparRegex(busca), $options: "i" }
            const autoresEncontrados = await autor.find({ nome: regex }).distinct("_id")
            filtro.$or = [{ titulo: regex }, { editora: regex }, { autor: { $in: autoresEncontrados } }]
        }
        if (autorId) filtro.autor = autorId

        const [dados, total] = await Promise.all([
            livro.find(filtro)
                .sort({ ...ordem, _id: 1 })
                .collation({ locale: "pt", strength: 1 })
                .skip(pular)
                .limit(limite)
                .populate("autor", DADOS_DO_AUTOR),
            livro.countDocuments(filtro)
        ])

        res.status(200).json(montarRespostaPaginada(dados, total, pagina, limite))
    }

    static async listarLivroPorId(req, res) {
        const livroEncontrado = await livro.findById(req.params.id).populate("autor", DADOS_DO_AUTOR)
        if (!livroEncontrado) throw new NaoEncontrado("Livro não encontrado")
        res.status(200).json(livroEncontrado)
    }

    static async cadastrarLivro(req, res) {
        const dados = filtrarCampos(req.body)
        await garantirQueAutorExiste(dados.autor)

        const novoLivro = await livro.create(dados)
        await novoLivro.populate("autor", DADOS_DO_AUTOR)
        res.status(201).json(novoLivro)
    }

    static async atualizarLivro(req, res) {
        const dados = filtrarCampos(req.body)
        await garantirQueAutorExiste(dados.autor)

        const livroAtualizado = await livro
            .findByIdAndUpdate(req.params.id, dados, { returnDocument: "after", runValidators: true })
            .populate("autor", DADOS_DO_AUTOR)
        if (!livroAtualizado) throw new NaoEncontrado("Livro não encontrado")
        res.status(200).json(livroAtualizado)
    }

    static async excluirLivro(req, res) {
        const livroRemovido = await livro.findByIdAndDelete(req.params.id)
        if (!livroRemovido) throw new NaoEncontrado("Livro não encontrado")
        res.status(200).json({ mensagem: "Livro removido com sucesso" })
    }

}

export default LivroController
