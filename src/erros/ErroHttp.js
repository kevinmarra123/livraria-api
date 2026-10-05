class ErroHttp extends Error {
    constructor(mensagem, status = 500) {
        super(mensagem)
        this.status = status
    }
}

export class NaoEncontrado extends ErroHttp {
    constructor(mensagem = "Recurso não encontrado") {
        super(mensagem, 404)
    }
}

export class RequisicaoIncorreta extends ErroHttp {
    constructor(mensagem = "Um ou mais dados fornecidos estão incorretos") {
        super(mensagem, 400)
    }
}

export class Conflito extends ErroHttp {
    constructor(mensagem) {
        super(mensagem, 409)
    }
}

export default ErroHttp
