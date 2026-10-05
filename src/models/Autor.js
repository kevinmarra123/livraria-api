import mongoose from "mongoose"

const autorSchema = new mongoose.Schema({
    nome: {
        type: String,
        required: [true, "O nome do autor é obrigatório"],
        trim: true,
        maxlength: [120, "O nome do autor pode ter no máximo 120 caracteres"]
    },
    nacionalidade: { type: String, trim: true }
}, { versionKey: false, timestamps: true })

const autor = mongoose.model("autores", autorSchema)

export default autor
