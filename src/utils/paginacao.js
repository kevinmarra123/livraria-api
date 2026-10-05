import { RequisicaoIncorreta } from "../erros/ErroHttp.js"

const LIMITE_MAXIMO = 50

export function lerPaginacao(query) {
    const pagina = Number(query.pagina ?? 1)
    const limite = Number(query.limite ?? 12)

    if (!Number.isInteger(pagina) || pagina < 1) {
        throw new RequisicaoIncorreta("O parâmetro \"pagina\" deve ser um inteiro maior que zero")
    }
    if (!Number.isInteger(limite) || limite < 1 || limite > LIMITE_MAXIMO) {
        throw new RequisicaoIncorreta(`O parâmetro "limite" deve ser um inteiro entre 1 e ${LIMITE_MAXIMO}`)
    }

    return { pagina, limite, pular: (pagina - 1) * limite }
}

export function montarRespostaPaginada(dados, total, pagina, limite) {
    return {
        dados,
        total,
        pagina,
        limite,
        totalPaginas: Math.max(1, Math.ceil(total / limite))
    }
}

export function escaparRegex(texto) {
    return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
