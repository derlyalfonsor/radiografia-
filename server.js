require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();

// Configuración básica
app.use(cors());
app.use(express.json());

// Conexión a MongoDB con configuración mejorada
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  retryWrites: true,
  w: 'majority'
})
.then(() => console.log('✅ Conectado a MongoDB Atlas'))
.catch(err => {
  console.error('❌ Error de conexión a MongoDB:', err.message);
  process.exit(1);
});

// Modelo de Paciente
const pacienteSchema = new mongoose.Schema({
  idPaciente: { type: String, required: true, unique: true },
  nombre: { type: String, required: true },
  radiografias: [{
    idRadiografia: { type: String, required: true },
    tipo: { type: String, required: true },
    estado: { 
      type: String, 
      enum: ['pendiente', 'lista', 'revisada'],
      default: 'pendiente'
    },
    fechaNotificacion: Date
  }]
}, { timestamps: true });

const Paciente = mongoose.model('Paciente', pacienteSchema);

// Middleware para manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Algo salió mal!' });
});

// --- ENDPOINTS DE LA API ---

// Crear nuevo paciente
app.post('/api/pacientes', async (req, res) => {
  try {
    const { idPaciente, nombre, radiografias } = req.body;
    
    if (!idPaciente || !nombre) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    const paciente = new Paciente({ idPaciente, nombre, radiografias: radiografias || [] });
    await paciente.save();
    
    res.status(201).json({
      success: true,
      data: paciente,
      message: 'Paciente creado exitosamente'
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'El ID de paciente ya existe' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Actualizar estado de radiografía
app.put('/api/pacientes/:id/radiografias/:idRad', async (req, res) => {
  try {
    const paciente = await Paciente.findById(req.params.id);
    if (!paciente) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }

    const radiografia = paciente.radiografias.find(
      r => r.idRadiografia === req.params.idRad
    );
    
    if (!radiografia) {
      return res.status(404).json({ error: 'Radiografía no encontrada' });
    }

    radiografia.estado = req.body.estado;
    if (req.body.estado === 'lista') {
      radiografia.fechaNotificacion = new Date();
    }

    await paciente.save();
    
    res.json({
      success: true,
      data: paciente,
      message: 'Estado actualizado correctamente'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener todos los pacientes
app.get('/api/pacientes', async (req, res) => {
  try {
    const pacientes = await Paciente.find().sort({ createdAt: -1 });
    res.json({ success: true, data: pacientes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Obtener paciente específico
app.get('/api/pacientes/:id', async (req, res) => {
  try {
    const paciente = await Paciente.findById(req.params.id);
    if (!paciente) {
      return res.status(404).json({ error: 'Paciente no encontrado' });
    }
    res.json({ success: true, data: paciente });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- INTERFAZ WEB ---

app.get('/', async (req, res) => {
  try {
    if (!req.query.id) {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Sistema de Radiografías</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            /* ... (mantén tus estilos existentes) ... */
          </style>
        </head>
        <body>
          <h1>🔍 Consulta de Radiografías</h1>
          <form method="get">
            <label for="id"><strong>Ingrese ID del paciente:</strong></label><br>
            <input type="text" id="id" name="id" required placeholder="Ej: PAC-001-2023">
            <button type="submit">Buscar</button>
          </form>
          <p><strong>Endpoints API:</strong></p>
          <ul>
            <li><strong>POST</strong> /api/pacientes - Crear paciente</li>
            <li><strong>PUT</strong> /api/pacientes/:id/radiografias/:idRad - Actualizar estado</li>
            <li><strong>GET</strong> /api/pacientes - Listar todos los pacientes</li>
          </ul>
        </body>
        </html>
      `);
    }

    const paciente = await Paciente.findOne({ idPaciente: req.query.id }) || 
                     await Paciente.findById(req.query.id);
    
    if (!paciente) {
      return res.send(`
        <h1>⚠️ Paciente no encontrado</h1>
        <p>El ID <strong>${req.query.id}</strong> no existe en nuestros registros.</p>
        <a href="/">Volver</a>
      `);
    }

    // ... (mantén tu lógica de visualización de radiografías existente)

  } catch (err) {
    res.send(`
      <h1>❌ Error</h1>
      <p>${err.message}</p>
      <a href="/">Volver</a>
    `);
  }
});

// Health Check para Render
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    dbStatus: mongoose.connection.readyState === 1 ? 'Conectado' : 'Desconectado',
    timestamp: new Date()
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 10000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`🚀 Servidor corriendo en http://${HOST}:${PORT}`);
  console.log('🔍 Health check disponible en /health');
});