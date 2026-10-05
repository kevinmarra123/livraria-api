const $ = (seletor) => document.querySelector(seletor)

const LIVROS_POR_PAGINA = 12

const estado = {
    filtros: { pagina: 1, busca: "", autor: "", ordenacao: "recentes" },
    livrosPorId: new Map(),
    autores: [],
    buscaAutores: "",
    livroEmEdicao: null,
    autorEmEdicao: null,
    aoSalvarAutor: null
}

const formatoPreco = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })

const ICONES = {
    editar: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`,
    excluir: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>`,
    livro: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5V5a2 2 0 0 1 2-2h13v16H6.5A2.5 2.5 0 0 0 4 21.5v-2Z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H19"/></svg>`,
    pessoa: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>`,
    alerta: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/></svg>`
}

// ---------- Utilitários ----------

function escapar(texto) {
    const entidades = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }
    return String(texto ?? "").replace(/[&<>"']/g, (c) => entidades[c])
}

function matizDe(texto) {
    let hash = 0
    for (const caractere of texto) hash = (hash * 31 + caractere.codePointAt(0)) >>> 0
    return hash % 360
}

function iniciais(texto) {
    const palavras = texto.split(/\s+/).filter((p) => p.length > 2)
    const base = palavras.length ? palavras : texto.split(/\s+/)
    return base.slice(0, 2).map((p) => p[0]).join("").toUpperCase()
}

function debounce(funcao, espera = 300) {
    let temporizador
    return (...argumentos) => {
        clearTimeout(temporizador)
        temporizador = setTimeout(() => funcao(...argumentos), espera)
    }
}

function plural(quantidade, singular, pluralForma) {
    return `${quantidade} ${quantidade === 1 ? singular : pluralForma}`
}

class ErroApi extends Error {
    constructor(mensagem, detalhes = []) {
        super(mensagem)
        this.detalhes = detalhes
    }
}

async function api(caminho, { metodo = "GET", corpo } = {}) {
    let resposta
    try {
        resposta = await fetch(caminho, {
            method: metodo,
            headers: corpo ? { "Content-Type": "application/json" } : undefined,
            body: corpo ? JSON.stringify(corpo) : undefined
        })
    } catch {
        throw new ErroApi("Não foi possível conectar ao servidor")
    }

    const dados = await resposta.json().catch(() => null)
    if (!resposta.ok) {
        throw new ErroApi(dados?.mensagem ?? `Erro ${resposta.status}`, dados?.erros ?? [])
    }
    return dados
}

// ---------- Avisos e confirmação ----------

function avisar(mensagem, tipo = "sucesso") {
    const aviso = document.createElement("div")
    aviso.className = `aviso aviso--${tipo}`
    aviso.setAttribute("role", tipo === "erro" ? "alert" : "status")
    aviso.textContent = mensagem
    $("#avisos").append(aviso)

    setTimeout(() => {
        aviso.classList.add("aviso--saindo")
        setTimeout(() => aviso.remove(), 220)
    }, tipo === "erro" ? 5000 : 3200)
}

function confirmar({ titulo, mensagem, acao = "Excluir" }) {
    const dialogo = $("#dialogo-confirmacao")
    $("#confirmacao-titulo").textContent = titulo
    $("#confirmacao-mensagem").textContent = mensagem
    $("#confirmacao-acao").textContent = acao
    dialogo.returnValue = ""
    dialogo.showModal()

    return new Promise((resolver) => {
        dialogo.addEventListener("close", () => resolver(dialogo.returnValue === "confirmar"), { once: true })
    })
}

function mostrarErroNoFormulario(seletor, erro) {
    const caixa = $(seletor)
    const detalhes = erro.detalhes?.length
        ? `<ul>${erro.detalhes.map((d) => `<li>${escapar(d)}</li>`).join("")}</ul>`
        : ""
    caixa.innerHTML = `<strong>${escapar(erro.message)}</strong>${detalhes}`
    caixa.hidden = false
}

function estadoVazio({ icone = ICONES.livro, titulo, texto, acao = "" }) {
    return `
        <div class="vazio">
            <span class="vazio__icone">${icone}</span>
            <h3>${escapar(titulo)}</h3>
            <p>${escapar(texto)}</p>
            ${acao}
        </div>`
}

function esqueletos(quantidade) {
    return Array.from({ length: quantidade }, () => `<div class="esqueleto" aria-hidden="true"></div>`).join("")
}

// ---------- Livros ----------

let ultimaRequisicaoDeLivros = 0

async function carregarLivros() {
    const requisicao = ++ultimaRequisicaoDeLivros
    const grade = $("#grade-livros")
    grade.setAttribute("aria-busy", "true")
    if (!grade.children.length) grade.innerHTML = esqueletos(8)

    const { pagina, busca, autor, ordenacao } = estado.filtros
    const parametros = new URLSearchParams({ pagina, limite: LIVROS_POR_PAGINA, ordenacao })
    if (busca) parametros.set("busca", busca)
    if (autor) parametros.set("autor", autor)

    try {
        const resposta = await api(`/livros?${parametros}`)
        if (requisicao !== ultimaRequisicaoDeLivros) return

        if (resposta.pagina > resposta.totalPaginas) {
            estado.filtros.pagina = resposta.totalPaginas
            return carregarLivros()
        }
        renderizarLivros(resposta)
    } catch (erro) {
        if (requisicao !== ultimaRequisicaoDeLivros) return
        grade.innerHTML = estadoVazio({
            icone: ICONES.alerta,
            titulo: "Não foi possível carregar os livros",
            texto: erro.message,
            acao: `<button class="botao botao--secundario" type="button" data-acao="recarregar">Tentar de novo</button>`
        })
        $("#paginacao").innerHTML = ""
        $("#resumo-livros").textContent = ""
    } finally {
        if (requisicao === ultimaRequisicaoDeLivros) grade.removeAttribute("aria-busy")
    }
}

function cartaoLivro(livro) {
    const nomeDoAutor = livro.autor?.nome ?? "Autor desconhecido"
    const etiquetas = [
        livro.editora && `<span class="etiqueta">${escapar(livro.editora)}</span>`,
        livro.paginas != null && `<span class="etiqueta">${livro.paginas} págs.</span>`
    ].filter(Boolean).join("")
    const preco = livro.preco != null
        ? `<strong class="preco">${formatoPreco.format(livro.preco)}</strong>`
        : `<span class="preco preco--vazio">Sem preço</span>`

    return `
        <article class="cartao-livro">
            <div class="capa" style="--matiz: ${matizDe(livro.titulo)}" aria-hidden="true">
                <span>${escapar(iniciais(livro.titulo))}</span>
            </div>
            <div class="cartao-livro__info">
                <h3 title="${escapar(livro.titulo)}">${escapar(livro.titulo)}</h3>
                <p class="cartao-livro__autor">${escapar(nomeDoAutor)}</p>
                ${etiquetas ? `<div class="etiquetas">${etiquetas}</div>` : ""}
            </div>
            <footer class="cartao-livro__rodape">
                ${preco}
                <div class="acoes">
                    <button class="botao-icone" type="button" data-acao="editar-livro" data-id="${livro._id}" aria-label="Editar ${escapar(livro.titulo)}" title="Editar">${ICONES.editar}</button>
                    <button class="botao-icone botao-icone--perigo" type="button" data-acao="excluir-livro" data-id="${livro._id}" aria-label="Excluir ${escapar(livro.titulo)}" title="Excluir">${ICONES.excluir}</button>
                </div>
            </footer>
        </article>`
}

function renderizarLivros({ dados, total, pagina, totalPaginas }) {
    estado.livrosPorId = new Map(dados.map((livro) => [livro._id, livro]))
    const filtrando = Boolean(estado.filtros.busca || estado.filtros.autor)
    const grade = $("#grade-livros")

    if (!dados.length) {
        grade.innerHTML = filtrando
            ? estadoVazio({
                titulo: "Nenhum livro encontrado",
                texto: "Tente outra busca ou limpe os filtros.",
                acao: `<button class="botao botao--secundario" type="button" data-acao="limpar-filtros">Limpar filtros</button>`
            })
            : estadoVazio({
                titulo: "Seu acervo está vazio",
                texto: "Cadastre o primeiro livro para começar.",
                acao: `<button class="botao botao--primario" type="button" data-acao="novo-livro">Novo livro</button>`
            })
    } else {
        grade.innerHTML = dados.map(cartaoLivro).join("")
    }

    $("#resumo-livros").textContent = total
        ? `${plural(total, "livro", "livros")}${filtrando ? (total === 1 ? " encontrado" : " encontrados") : ""}`
        : ""
    renderizarPaginacao(pagina, totalPaginas)
}

function renderizarPaginacao(pagina, totalPaginas) {
    const paginacao = $("#paginacao")
    if (totalPaginas <= 1) {
        paginacao.innerHTML = ""
        return
    }
    paginacao.innerHTML = `
        <button class="botao botao--secundario" type="button" data-acao="pagina" data-pagina="${pagina - 1}" ${pagina === 1 ? "disabled" : ""}>Anterior</button>
        <span>Página ${pagina} de ${totalPaginas}</span>
        <button class="botao botao--secundario" type="button" data-acao="pagina" data-pagina="${pagina + 1}" ${pagina === totalPaginas ? "disabled" : ""}>Próxima</button>`
}

function abrirFormularioDeLivro(livro = null) {
    estado.livroEmEdicao = livro
    const formulario = $("#form-livro")
    const campos = formulario.elements
    formulario.reset()
    $("#erro-form-livro").hidden = true
    $("#titulo-dialogo-livro").textContent = livro ? "Editar livro" : "Novo livro"

    preencherSelectDeAutoresDoFormulario()
    campos.titulo.value = livro?.titulo ?? ""
    campos.autor.value = livro?.autor?._id ?? estado.filtros.autor ?? ""
    campos.editora.value = livro?.editora ?? ""
    campos.preco.value = livro?.preco ?? ""
    campos.paginas.value = livro?.paginas ?? ""

    $("#dialogo-livro").showModal()
    campos.titulo.focus()
}

async function salvarLivro(evento) {
    evento.preventDefault()
    const formulario = evento.currentTarget
    if (!formulario.reportValidity()) return

    const campos = formulario.elements
    const numeroOuNulo = (valor) => (valor === "" ? null : Number(valor))
    const dados = {
        titulo: campos.titulo.value.trim(),
        autor: campos.autor.value,
        editora: campos.editora.value.trim(),
        preco: numeroOuNulo(campos.preco.value),
        paginas: numeroOuNulo(campos.paginas.value)
    }

    const botao = formulario.querySelector("[type=submit]")
    botao.disabled = true
    try {
        const livro = estado.livroEmEdicao
        if (livro) {
            await api(`/livros/${livro._id}`, { metodo: "PUT", corpo: dados })
        } else {
            await api("/livros", { metodo: "POST", corpo: dados })
        }
        $("#dialogo-livro").close()
        avisar(livro ? "Livro atualizado" : "Livro cadastrado")
        await Promise.all([carregarLivros(), carregarAutores()])
    } catch (erro) {
        mostrarErroNoFormulario("#erro-form-livro", erro)
    } finally {
        botao.disabled = false
    }
}

async function excluirLivro(livro) {
    const confirmado = await confirmar({
        titulo: "Excluir livro?",
        mensagem: `"${livro.titulo}" será removido permanentemente.`
    })
    if (!confirmado) return

    try {
        await api(`/livros/${livro._id}`, { metodo: "DELETE" })
        avisar("Livro removido")
        await Promise.all([carregarLivros(), carregarAutores()])
    } catch (erro) {
        avisar(erro.message, "erro")
    }
}

// ---------- Autores ----------

async function carregarAutores() {
    const lista = $("#lista-autores")
    if (!estado.autores.length && !lista.children.length) lista.innerHTML = esqueletos(4)

    try {
        estado.autores = await api("/autores")
    } catch (erro) {
        lista.innerHTML = estadoVazio({
            icone: ICONES.alerta,
            titulo: "Não foi possível carregar os autores",
            texto: erro.message,
            acao: `<button class="botao botao--secundario" type="button" data-acao="recarregar">Tentar de novo</button>`
        })
        return
    }

    $("#total-autores").textContent = estado.autores.length
    $("#total-livros").textContent = estado.autores.reduce((soma, a) => soma + a.totalLivros, 0)
    preencherFiltroDeAutores()
    preencherSelectDeAutoresDoFormulario()
    renderizarAutores()
}

function opcoesDeAutores() {
    return estado.autores.map((a) => `<option value="${a._id}">${escapar(a.nome)}</option>`).join("")
}

function preencherFiltroDeAutores() {
    const filtro = $("#filtro-autor")
    filtro.innerHTML = `<option value="">Todos os autores</option>${opcoesDeAutores()}`

    const autorAindaExiste = estado.autores.some((a) => a._id === estado.filtros.autor)
    if (!autorAindaExiste && estado.filtros.autor) {
        estado.filtros.autor = ""
        carregarLivros()
    }
    filtro.value = estado.filtros.autor
}

function preencherSelectDeAutoresDoFormulario() {
    const select = $("#livro-autor")
    const valorAtual = select.value
    select.innerHTML = estado.autores.length
        ? `<option value="" disabled>Selecione um autor</option>${opcoesDeAutores()}`
        : `<option value="" disabled>Cadastre um autor primeiro</option>`
    select.value = valorAtual
    if (!select.value) select.selectedIndex = 0
}

function cartaoAutor(autor) {
    const nacionalidade = autor.nacionalidade
        ? `<span>${escapar(autor.nacionalidade)}</span>`
        : `<span>Nacionalidade não informada</span>`
    const livros = autor.totalLivros
        ? `<button class="link" type="button" data-acao="ver-livros-do-autor" data-id="${autor._id}">${plural(autor.totalLivros, "livro", "livros")}</button>`
        : `<span>Nenhum livro</span>`

    return `
        <article class="cartao-autor">
            <span class="avatar" style="--matiz: ${matizDe(autor.nome)}" aria-hidden="true">${escapar(iniciais(autor.nome))}</span>
            <div class="cartao-autor__info">
                <h3 title="${escapar(autor.nome)}">${escapar(autor.nome)}</h3>
                <div class="cartao-autor__meta">${nacionalidade}${livros}</div>
            </div>
            <div class="acoes">
                <button class="botao-icone" type="button" data-acao="editar-autor" data-id="${autor._id}" aria-label="Editar ${escapar(autor.nome)}" title="Editar">${ICONES.editar}</button>
                <button class="botao-icone botao-icone--perigo" type="button" data-acao="excluir-autor" data-id="${autor._id}" aria-label="Excluir ${escapar(autor.nome)}" title="Excluir">${ICONES.excluir}</button>
            </div>
        </article>`
}

function renderizarAutores() {
    const termo = estado.buscaAutores.toLocaleLowerCase("pt-BR")
    const autores = termo
        ? estado.autores.filter((a) => a.nome.toLocaleLowerCase("pt-BR").includes(termo))
        : estado.autores
    const lista = $("#lista-autores")

    if (!estado.autores.length) {
        lista.innerHTML = estadoVazio({
            icone: ICONES.pessoa,
            titulo: "Nenhum autor cadastrado",
            texto: "Todo livro precisa de um autor. Comece cadastrando um.",
            acao: `<button class="botao botao--primario" type="button" data-acao="novo-autor">Novo autor</button>`
        })
    } else if (!autores.length) {
        lista.innerHTML = estadoVazio({ icone: ICONES.pessoa, titulo: "Nenhum autor encontrado", texto: "Tente outro nome." })
    } else {
        lista.innerHTML = autores.map(cartaoAutor).join("")
    }

    $("#resumo-autores").textContent = autores.length ? plural(autores.length, "autor", "autores") : ""
}

function abrirFormularioDeAutor(autor = null, aoSalvar = null) {
    estado.autorEmEdicao = autor
    estado.aoSalvarAutor = aoSalvar
    const formulario = $("#form-autor")
    formulario.reset()
    $("#erro-form-autor").hidden = true
    $("#titulo-dialogo-autor").textContent = autor ? "Editar autor" : "Novo autor"
    formulario.elements.nome.value = autor?.nome ?? ""
    formulario.elements.nacionalidade.value = autor?.nacionalidade ?? ""

    $("#dialogo-autor").showModal()
    formulario.elements.nome.focus()
}

async function salvarAutor(evento) {
    evento.preventDefault()
    const formulario = evento.currentTarget
    if (!formulario.reportValidity()) return

    const dados = {
        nome: formulario.elements.nome.value.trim(),
        nacionalidade: formulario.elements.nacionalidade.value.trim()
    }

    const botao = formulario.querySelector("[type=submit]")
    botao.disabled = true
    try {
        const autor = estado.autorEmEdicao
        const salvo = autor
            ? await api(`/autores/${autor._id}`, { metodo: "PUT", corpo: dados })
            : await api("/autores", { metodo: "POST", corpo: dados })

        $("#dialogo-autor").close()
        avisar(autor ? "Autor atualizado" : "Autor cadastrado")
        await carregarAutores()
        if (autor) carregarLivros()
        estado.aoSalvarAutor?.(salvo)
    } catch (erro) {
        mostrarErroNoFormulario("#erro-form-autor", erro)
    } finally {
        botao.disabled = false
        estado.aoSalvarAutor = null
    }
}

async function excluirAutor(autor) {
    if (autor.totalLivros > 0) {
        avisar(`${autor.nome} tem ${plural(autor.totalLivros, "livro", "livros")}. Exclua ou troque o autor deles antes.`, "info")
        return
    }

    const confirmado = await confirmar({
        titulo: "Excluir autor?",
        mensagem: `${autor.nome} será removido permanentemente.`
    })
    if (!confirmado) return

    try {
        await api(`/autores/${autor._id}`, { metodo: "DELETE" })
        avisar("Autor removido")
        await carregarAutores()
    } catch (erro) {
        avisar(erro.message, "erro")
    }
}

// ---------- Navegação ----------

function trocarAba(aba) {
    for (const botao of document.querySelectorAll("[data-aba]")) {
        const ativa = botao.dataset.aba === aba
        botao.setAttribute("aria-selected", String(ativa))
        $(`#${botao.getAttribute("aria-controls")}`).hidden = !ativa
    }
}

function verLivrosDoAutor(autorId) {
    estado.filtros = { ...estado.filtros, autor: autorId, busca: "", pagina: 1 }
    $("#filtro-autor").value = autorId
    $("#busca-livros").value = ""
    trocarAba("livros")
    carregarLivros()
}

function limparFiltros() {
    estado.filtros = { ...estado.filtros, autor: "", busca: "", pagina: 1 }
    $("#filtro-autor").value = ""
    $("#busca-livros").value = ""
    carregarLivros()
}

function alternarTema() {
    const temaAtual = document.documentElement.dataset.theme
        ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    const novoTema = temaAtual === "dark" ? "light" : "dark"
    document.documentElement.dataset.theme = novoTema
    try {
        localStorage.setItem("tema", novoTema)
    } catch {
        // sem armazenamento disponível, o tema vale só para esta visita
    }
}

// ---------- Eventos ----------

document.addEventListener("click", (evento) => {
    const alvo = evento.target.closest("[data-acao], [data-aba], [data-fechar]")
    if (!alvo) return

    if (alvo.hasAttribute("data-fechar")) {
        alvo.closest("dialog").close()
        return
    }
    if (alvo.dataset.aba) {
        trocarAba(alvo.dataset.aba)
        return
    }

    const id = alvo.dataset.id
    const autor = () => estado.autores.find((a) => a._id === id)

    switch (alvo.dataset.acao) {
        case "novo-livro":
            abrirFormularioDeLivro()
            break
        case "editar-livro":
            abrirFormularioDeLivro(estado.livrosPorId.get(id))
            break
        case "excluir-livro":
            excluirLivro(estado.livrosPorId.get(id))
            break
        case "novo-autor":
            abrirFormularioDeAutor()
            break
        case "atalho-novo-autor":
            abrirFormularioDeAutor(null, (novoAutor) => {
                $("#livro-autor").value = novoAutor._id
            })
            break
        case "editar-autor":
            abrirFormularioDeAutor(autor())
            break
        case "excluir-autor":
            excluirAutor(autor())
            break
        case "ver-livros-do-autor":
            verLivrosDoAutor(id)
            break
        case "pagina":
            estado.filtros.pagina = Number(alvo.dataset.pagina)
            carregarLivros()
            window.scrollTo({ top: 0, behavior: "smooth" })
            break
        case "limpar-filtros":
            limparFiltros()
            break
        case "recarregar":
            carregarAutores()
            carregarLivros()
            break
    }
})

for (const dialogo of document.querySelectorAll("dialog")) {
    dialogo.addEventListener("click", (evento) => {
        if (evento.target === dialogo) dialogo.close()
    })
}

$("#busca-livros").addEventListener("input", debounce((evento) => {
    estado.filtros = { ...estado.filtros, busca: evento.target.value.trim(), pagina: 1 }
    carregarLivros()
}))

$("#filtro-autor").addEventListener("change", (evento) => {
    estado.filtros = { ...estado.filtros, autor: evento.target.value, pagina: 1 }
    carregarLivros()
})

$("#ordenacao").addEventListener("change", (evento) => {
    estado.filtros = { ...estado.filtros, ordenacao: evento.target.value, pagina: 1 }
    carregarLivros()
})

$("#busca-autores").addEventListener("input", (evento) => {
    estado.buscaAutores = evento.target.value.trim()
    renderizarAutores()
})

$("#form-livro").addEventListener("submit", salvarLivro)
$("#form-autor").addEventListener("submit", salvarAutor)
$("#alternar-tema").addEventListener("click", alternarTema)

carregarAutores()
carregarLivros()
