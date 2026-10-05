import mongoose from "mongoose"

const livroSchema = new mongoose.Schema({
    titulo: {
        type: String,
        required: [true, "O título do livro é obrigatório"],
        trim: true,
        maxlength: [200, "O título pode ter no máximo 200 caracteres"]
    },
    autor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "autores",
        required: [true, "O autor é obrigatório"]
    },
    editora: { type: String, trim: true },
    preco: { type: Number, min: [0, "O preço não pode ser negativo"] },
    paginas: {
        type: Number,
        min: [1, "O número de páginas deve ser no mínimo 1"],
        max: [10000, "O número de páginas deve ser no máximo 10000"]
    }
}, { versionKey: false, timestamps: true })

const livro = mongoose.model("livros", livroSchema)

export default livro
