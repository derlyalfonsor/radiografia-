require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Inicializar Express
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Conexión a MongoDB Atlas (con opciones mejoradas)
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  retryWrites: true,
  w: 'majority'
})
.then(() => console.log('✅ **Conexión exitosa a MongoDB Atlas**'))
.catch(err => {
  console.error('❌ **Error de conexión a MongoDB:**', err.message);
  process.exit(1); // Detener la aplicación si no hay conexión a la DB
});

// --- MODELO DE PACIENTE ---
const pacienteSchema = new mongoose.Schema({
  idPaciente: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true
  },
  nombre: { 
    type: String, 
    required: true,
    trim: true
  },
  radiografias: [{
    idRadiografia: { 
      type: String, 
      required: true,
      trim: true
    },
    tipo: { 
      type: String, 
      required: true,
      enum: ['Torax PA', 'Columna Lumbar', 'Cráneo AP', 'Abdomen'],
      trim: true
    },
    estado: { 
      type: String, 
      enum: ['pendiente', 'lista', 'revisada'],
      default: 'pendiente'
    },
    fechaNotificacion: { 
      type: Date,
      default: null
    }
  }]
}, { 
  timestamps: true // Añade createdAt y updatedAt automáticamente
});

const Paciente = mongoose.model('Paciente', pacienteSchema);

// --- ENDPOINTS DE LA API ---

// [POST] Crear nuevo paciente
app.post('/api/pacientes', async (req, res) => {
  try {
    const { idPaciente, nombre, radiografias } = req.body;

    // Validación de campos obligatorios
    if (!idPaciente || !nombre) {
      return res.status(400).json({ 
        success: false,
        error: '❌ **Faltan campos obligatorios (idPaciente y nombre)**' 
      });
    }

    // Crear y guardar el paciente
    const paciente = new Paciente({ 
      idPaciente, 
      nombre, 
      radiografias: radiografias || [] 
    });
    await paciente.save();

    // Respuesta exitosa
    res.status(201).json({
      success: true,
      message: '✅ **Paciente creado exitosamente**',
      data: paciente
    });

  } catch (err) {
    // Manejo de errores
    if (err.code === 11000) {
      return res.status(400).json({ 
        success: false,
        error: '❌ **El ID de paciente ya existe**' 
      });
    }
    res.status(500).json({ 
      success: false,
      error: `❌ **Error del servidor:** ${err.message}` 
    });
  }
});

// [GET] Obtener todos los pacientes
app.get('/api/pacientes', async (req, res) => {
  try {
    const pacientes = await Paciente.find().sort({ createdAt: -1 });
    res.json({ 
      success: true,
      count: pacientes.length,
      data: pacientes 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: `❌ **Error al obtener pacientes:** ${err.message}` 
    });
  }
});

// [GET] Buscar paciente por ID
app.get('/api/pacientes/:id', async (req, res) => {
  try {
    const paciente = await Paciente.findOne({ 
      $or: [
        { _id: req.params.id },
        { idPaciente: req.params.id }
      ]
    });

    if (!paciente) {
      return res.status(404).json({ 
        success: false,
        error: '❌ **Paciente no encontrado**' 
      });
    }

    res.json({ 
      success: true,
      data: paciente 
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: `❌ **Error al buscar paciente:** ${err.message}` 
    });
  }
});

// [PUT] Actualizar estado de una radiografía
app.put('/api/pacientes/:id/radiografias/:idRad', async (req, res) => {
  try {
    const { estado } = req.body;

    // Validar estado
    if (!['pendiente', 'lista', 'revisada'].includes(estado)) {
      return res.status(400).json({ 
        success: false,
        error: '❌ **Estado no válido (usar: pendiente, lista o revisada)**' 
      });
    }

    // Buscar paciente
    const paciente = await Paciente.findById(req.params.id);
    if (!paciente) {
      return res.status(404).json({ 
        success: false,
        error: '❌ **Paciente no encontrado**' 
      });
    }

    // Buscar radiografía
    const radiografia = paciente.radiografias.find(
      r => r.idRadiografia === req.params.idRad
    );
    if (!radiografia) {
      return res.status(404).json({ 
        success: false,
        error: '❌ **Radiografía no encontrada**' 
      });
    }

    // Actualizar estado y fecha
    radiografia.estado = estado;
    if (estado === 'lista') {
      radiografia.fechaNotificacion = new Date();
    }

    await paciente.save();

    res.json({ 
      success: true,
      message: '✅ **Estado actualizado correctamente**',
      data: paciente
    });
  } catch (err) {
    res.status(500).json({ 
      success: false,
      error: `❌ **Error al actualizar:** ${err.message}` 
    });
  }
});

// --- INTERFAZ WEB ---
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Sistema de Radiografías</title>
      <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #2c3e50; }
        code { background: #f4f4f4; padding: 2px 5px; border-radius: 3px; }
        .endpoint { margin: 15px 0; padding: 10px; background: #f9f9f9; border-left: 4px solid #3498db; }
      </style>
    </head>
    <body>
      <h1>🩺 Sistema de Gestión de Radiografías</h1>
      <p>API REST para gestión de pacientes y radiografías</p>
      
      <div class="endpoint">
        <h3>📌 Endpoints disponibles:</h3>
        <ul>
          <li><strong>POST</strong> <code>/api/pacientes</code> - Crear paciente</li>
          <li><strong>GET</strong> <code>/api/pacientes</code> - Listar todos</li>
          <li><strong>GET</strong> <code>/api/pacientes/:id</code> - Buscar por ID</li>
          <li><strong>PUT</strong> <code>/api/pacientes/:id/radiografias/:idRad</code> - Actualizar estado</li>
        </ul>
      </div>

      <p>🔗 <strong>Health Check:</strong> <a href="/health">/health</a></p>
    </body>
    </html>
  `);
});

// Health Check (para Render)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: '✅ OK',
    dbStatus: mongoose.connection.readyState === 1 ? '✅ Conectado' : '❌ Desconectado',
    uptime: process.uptime(),
    timestamp: new Date()
  });
});

// Manejo de rutas no encontradas
app.use((req, res) => {
  res.status(404).json({ 
    success: false,
    error: '❌ Ruta no encontrada' 
  });
});

// Iniciar servidor
const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 **Servidor ejecutándose en http://0.0.0.0:${PORT}**`);
});