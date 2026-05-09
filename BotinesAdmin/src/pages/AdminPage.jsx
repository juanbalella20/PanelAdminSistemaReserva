import { useState, useEffect, useCallback } from "react";

const ADMIN_KEY = "botines_admin_secret";
const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

// ─── API helpers ─────────────────────────────────────────────────────────────

async function apiAdmin(method, path, secret, body = null) {
  const url = API_BASE_URL ? `${API_BASE_URL}/api/auth${path}` : `/api/auth${path}`;
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: {
        "Content-Type":  "application/json",
        "X-Admin-Secret": secret,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor");
  }

  const contentType = res.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json") ? await res.json() : null;
  if (!res.ok) throw new Error(data?.error ?? `Error ${res.status}`);
  return data;
}

// El teléfono del dueño se guarda sin "+" (ej. 5491123456789).
const TELEFONO_REGEX = /^\d{8,15}$/;

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AdminPage() {
  const [secret,     setSecret]     = useState(() => sessionStorage.getItem(ADMIN_KEY) ?? "");
  const [autenticado, setAutenticado] = useState(false);
  const [errorLogin,  setErrorLogin]  = useState("");

  // verifica el secreto contra el backend
  const verificar = async (e) => {
    e.preventDefault();
    setErrorLogin("");
    try {
      await apiAdmin("GET", "/usuarios", secret);
      sessionStorage.setItem(ADMIN_KEY, secret);
      setAutenticado(true);
    } catch (e) {
      if (e.message === "No se pudo conectar con el servidor") {
        setErrorLogin(e.message);
      } else {
        setErrorLogin("Secreto incorrecto");
      }
    }
  };

  if (!autenticado) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-10">
          <div className="flex items-center justify-center mb-6">
            <div className="w-12 h-12 rounded-full bg-botines-dark flex items-center justify-center mr-3">
              <i className="fas fa-shield-alt text-xl text-botines-light" />
            </div>
            <span className="text-2xl font-bold text-botines-dark">BOTINES Admin</span>
          </div>
          <p className="text-sm text-gray-500 text-center mb-6">Panel exclusivo de administración</p>
          <form onSubmit={verificar} className="space-y-4">
            <input
              type="password"
              value={secret}
              onChange={e => setSecret(e.target.value)}
              placeholder="Secreto de administración"
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-botines"
            />
            {errorLogin && (
              <p className="text-red-600 text-sm">{errorLogin}</p>
            )}
            <button
              type="submit"
              className="w-full bg-botines hover:bg-green-700 text-white font-bold py-2.5 rounded-lg text-sm"
            >
              Ingresar
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <PanelAdmin secret={secret} onCerrar={() => { sessionStorage.removeItem(ADMIN_KEY); setAutenticado(false); }} />;
}

// ─── Panel principal (cuando ya autenticó) ────────────────────────────────────

const FORM_INICIAL = {
  negocioNombre: "",
  phoneNumberId: "",
  direccion: "",
  usuario: "",
  password: "",
  nombre: "",
  banco: "",
  titular: "",
  cvu: "",
  aliasCbu: "",
  alquila_canchas: true,
  telefono: "",
};

function PanelAdmin({ secret, onCerrar }) {
  const [usuarios,    setUsuarios]    = useState([]);
  const [cargando,    setCargando]    = useState(true);
  const [form,        setForm]        = useState(FORM_INICIAL);
  const [enviando,    setEnviando]    = useState(false);
  const [borrando,    setBorrando]    = useState(null);
  const [bloqueando,  setBloqueando]  = useState(null);
  const [exito,       setExito]       = useState("");
  const [error,       setError]       = useState("");
  const [editando,    setEditando]    = useState(null); // usuario actualmente en edición

  const cargarUsuarios = useCallback(async () => {
    setCargando(true);
    try {
      const data = await apiAdmin("GET", "/usuarios", secret);
      setUsuarios(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setCargando(false);
    }
  }, [secret]);

  useEffect(() => { cargarUsuarios(); }, [cargarUsuarios]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === "checkbox" ? checked : value }));
  };

  const handleToggleBloqueo = async (u) => {
    const accion = u.bloqueado ? "desbloquear" : "bloquear";
    const aviso = u.bloqueado
      ? `¿Desbloquear el club "${u.negocio_nombre}"? El dueño volverá a poder ingresar y el bot tomará reservas.`
      : `¿Bloquear el club "${u.negocio_nombre}"? El dueño no podrá ingresar y el bot ignorará los mensajes. Los datos no se borran.`;
    if (!window.confirm(aviso)) return;
    setError(""); setExito("");
    setBloqueando(u.id);
    try {
      await apiAdmin("PATCH", `/negocios/${u.negocio_id}`, secret, { bloqueado: !u.bloqueado });
      setExito(`Club "${u.negocio_nombre}" ${accion === "bloquear" ? "bloqueado" : "desbloqueado"} correctamente`);
      cargarUsuarios();
    } catch (e) {
      setError(e.message);
    } finally {
      setBloqueando(null);
    }
  };

  const handleEliminar = async (u) => {
    if (!window.confirm(`¿Eliminar el club "${u.negocio_nombre}" y su usuario @${u.usuario}? Esta acción no se puede deshacer.`)) return;
    setError(""); setExito("");
    setBorrando(u.id);
    try {
      await apiAdmin("DELETE", `/usuarios/${u.id}`, secret);
      setExito(`Club "${u.negocio_nombre}" eliminado correctamente`);
      cargarUsuarios();
    } catch (e) {
      setError(e.message);
    } finally {
      setBorrando(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setExito("");
    if (!form.negocioNombre || !form.phoneNumberId || !form.direccion || !form.usuario || !form.password || !form.nombre) {
      setError("Completá todos los campos"); return;
    }
    if (!form.cvu || !form.banco || !form.titular) {
      setError("Banco, titular y CVU son obligatorios para procesar pagos"); return;
    }
    if (!/^\d{22}$/.test(form.cvu)) {
      setError("El CVU debe tener exactamente 22 dígitos"); return;
    }
    // El teléfono del dueño es obligatorio cuando el bot NO toma reservas.
    if (!form.alquila_canchas && !form.telefono) {
      setError("Si el bot no toma reservas, el teléfono del dueño es obligatorio para derivar al cliente"); return;
    }
    if (form.telefono && !TELEFONO_REGEX.test(form.telefono)) {
      setError('Teléfono inválido. Usá formato internacional sin "+", ej: 5491123456789'); return;
    }
    setEnviando(true);
    try {
      const data = await apiAdmin("POST", "/setup", secret, form);
      setExito(`✅ Negocio "${data.negocio.nombre}" y usuario "${data.usuario.usuario}" creados correctamente`);
      setForm(FORM_INICIAL);
      cargarUsuarios();
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-botines-dark flex items-center justify-center">
              <i className="fas fa-shield-alt text-botines-light" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">BOTINES Admin</h1>
              <p className="text-xs text-gray-500">Panel de administración</p>
            </div>
          </div>
          <button onClick={onCerrar} className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
            <i className="fas fa-sign-out-alt" /> Cerrar sesión
          </button>
        </div>

        {/* Formulario nuevo negocio + usuario */}
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-base font-bold text-gray-800 mb-4">
            <i className="fas fa-plus-circle text-botines mr-2" />
            Crear nuevo negocio y usuario
          </h2>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre del negocio</label>
              <input
                name="negocioNombre" value={form.negocioNombre} onChange={handleChange}
                placeholder="Ej: Complejo Los Pinos"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-botines"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Client ID (Phone Number ID) <span className="text-red-500">*</span>
              </label>
              <input
                name="phoneNumberId" value={form.phoneNumberId} onChange={handleChange}
                placeholder="Ej: 123456789012345"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-botines font-mono"
              />
              <p className="text-xs text-gray-400 mt-1">ID numérico del número de WhatsApp en Meta Business (phone_number_id)</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Dirección del negocio</label>
              <input
                name="direccion" value={form.direccion} onChange={handleChange}
                placeholder="Ej: Av. Corrientes 1234, Buenos Aires"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-botines"
              />
            </div>

            {/* Comportamiento de reservas */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-3 space-y-2">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="alquila_canchas"
                  checked={form.alquila_canchas}
                  onChange={handleChange}
                  className="mt-0.5 h-4 w-4 accent-botines"
                />
                <span className="text-xs text-blue-900">
                  <span className="font-semibold">El bot toma reservas automáticas</span>
                  <span className="block text-blue-700 mt-0.5">
                    Si está desactivado, el bot no muestra los flujos de Reservar / Mis reservas / Editar / Cancelar y deriva al dueño por WhatsApp.
                  </span>
                </span>
              </label>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  Teléfono del dueño {!form.alquila_canchas && <span className="text-red-500">*</span>}
                </label>
                <input
                  name="telefono" value={form.telefono} onChange={handleChange}
                  placeholder='Sin "+", ej: 5491123456789'
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-botines font-mono"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Se usa como link wa.me/&lt;telefono&gt; cuando el bot no maneja reservas automáticas.
                </p>
              </div>
            </div>

            {/* Medio de pago */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2.5">
              <p className="text-xs font-semibold text-yellow-800 mb-0.5">
                <i className="fas fa-exclamation-triangle mr-1" />
                Medio de cobro — requerido para procesar reservas
              </p>
              <p className="text-xs text-yellow-700">Sin CVU/Alias el sistema no puede transferir pagos al dueño de la cancha.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Banco <span className="text-red-500">*</span></label>
                <input
                  name="banco" value={form.banco} onChange={handleChange}
                  placeholder="Ej: Mercado Pago, Galicia"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-botines"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Titular de la cuenta <span className="text-red-500">*</span></label>
                <input
                  name="titular" value={form.titular} onChange={handleChange}
                  placeholder="Ej: Carlos García"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-botines"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">CVU <span className="text-red-500">*</span></label>
                <input
                  name="cvu" value={form.cvu} onChange={handleChange}
                  placeholder="22 dígitos"
                  maxLength={22}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-botines font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Alias CBU <span className="text-gray-400">(opcional)</span></label>
                <input
                  name="aliasCbu" value={form.aliasCbu} onChange={handleChange}
                  placeholder="Ej: lospinos.mp"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-botines"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Nombre del responsable</label>
              <input
                name="nombre" value={form.nombre} onChange={handleChange}
                placeholder="Ej: Carlos García"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-botines"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Usuario (para el login)</label>
                <input
                  name="usuario" value={form.usuario} onChange={handleChange}
                  placeholder="Ej: lospinos"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-botines"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Contraseña inicial</label>
                <input
                  name="password" value={form.password} onChange={handleChange}
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-botines"
                />
              </div>
            </div>

            {error  && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            {exito  && <p className="text-green-700 text-sm bg-green-50 rounded-lg px-3 py-2">{exito}</p>}

            <button
              type="submit" disabled={enviando}
              className="w-full bg-botines hover:bg-green-700 disabled:bg-gray-300 text-white font-bold py-2.5 rounded-lg text-sm"
            >
              {enviando ? <><i className="fas fa-circle-notch fa-spin mr-2" />Creando...</> : "Crear negocio y usuario"}
            </button>
          </form>
        </div>

        {/* Lista de usuarios existentes */}
        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-base font-bold text-gray-800 mb-4">
            <i className="fas fa-users text-botines mr-2" />
            Usuarios registrados
          </h2>

          {cargando ? (
            <p className="text-sm text-gray-400 text-center py-4"><i className="fas fa-circle-notch fa-spin mr-2" />Cargando...</p>
          ) : usuarios.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No hay usuarios todavía</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {usuarios.map(u => (
                <div key={u.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{u.negocio_nombre}</p>
                    <p className="text-xs text-gray-500">@{u.usuario} · {u.nombre}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {u.bloqueado && (
                        <span className="inline-flex items-center gap-1 text-xs text-white bg-red-600 border border-red-700 rounded px-1.5 py-0.5 font-semibold">
                          <i className="fas fa-ban" />
                          Bloqueado
                        </span>
                      )}
                      {u.alquila_canchas === false ? (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-700 bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5">
                          <i className="fas fa-hand-paper text-gray-500" />
                          Sin reservas automáticas
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 border border-green-200 rounded px-1.5 py-0.5">
                          <i className="fas fa-robot text-green-600" />
                          Reservas automáticas
                        </span>
                      )}
                      {!u.cvu && (
                        <span className="inline-flex items-center gap-1 text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-1.5 py-0.5">
                          <i className="fas fa-exclamation-triangle text-yellow-500" />
                          Sin medio de pago — reservas bloqueadas
                        </span>
                      )}
                      {u.alquila_canchas === false && !u.telefono && (
                        <span className="inline-flex items-center gap-1 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-0.5">
                          <i className="fas fa-exclamation-circle text-red-500" />
                          Falta teléfono del dueño
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">
                    {new Date(u.created_at).toLocaleDateString("es-AR")}
                  </span>
                  <button
                    onClick={() => setEditando(u)}
                    className="shrink-0 text-blue-500 hover:text-blue-700 p-1"
                    title="Editar negocio"
                  >
                    <i className="fas fa-pen" />
                  </button>
                  <button
                    onClick={() => handleToggleBloqueo(u)}
                    disabled={bloqueando === u.id}
                    className={`shrink-0 p-1 disabled:text-gray-300 ${u.bloqueado ? "text-green-600 hover:text-green-700" : "text-orange-500 hover:text-orange-700"}`}
                    title={u.bloqueado ? "Desbloquear club" : "Bloquear club"}
                  >
                    {bloqueando === u.id
                      ? <i className="fas fa-circle-notch fa-spin" />
                      : <i className={u.bloqueado ? "fas fa-unlock" : "fas fa-ban"} />}
                  </button>
                  <button
                    onClick={() => handleEliminar(u)}
                    disabled={borrando === u.id}
                    className="shrink-0 text-red-500 hover:text-red-700 disabled:text-gray-300 p-1"
                    title="Eliminar club"
                  >
                    {borrando === u.id
                      ? <i className="fas fa-circle-notch fa-spin" />
                      : <i className="fas fa-trash-alt" />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {editando && (
        <ModalEditarNegocio
          usuario={editando}
          secret={secret}
          onClose={() => setEditando(null)}
          onSaved={(msg) => { setEditando(null); setExito(msg); setError(""); cargarUsuarios(); }}
        />
      )}
    </div>
  );
}

// ─── Modal de edición de negocio (alquila_canchas y telefono) ─────────────────

function ModalEditarNegocio({ usuario, secret, onClose, onSaved }) {
  const [alquilaCanchas, setAlquilaCanchas] = useState(usuario.alquila_canchas !== false);
  const [telefono,       setTelefono]       = useState(usuario.telefono ?? "");
  const [guardando,      setGuardando]      = useState(false);
  const [error,          setError]          = useState("");

  const guardar = async (e) => {
    e.preventDefault();
    setError("");
    if (!alquilaCanchas && !telefono) {
      setError("Si el bot no toma reservas, el teléfono del dueño es obligatorio");
      return;
    }
    if (telefono && !TELEFONO_REGEX.test(telefono)) {
      setError('Teléfono inválido. Usá formato internacional sin "+", ej: 5491123456789');
      return;
    }
    if (!usuario.negocio_id) {
      setError("No se pudo identificar el negocio (falta negocio_id en la respuesta del backend)");
      return;
    }
    setGuardando(true);
    try {
      await apiAdmin("PATCH", `/negocios/${usuario.negocio_id}`, secret, {
        alquila_canchas: alquilaCanchas,
        telefono: telefono || null,
      });
      onSaved(`✅ Negocio "${usuario.negocio_nombre}" actualizado`);
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-800">
            <i className="fas fa-pen text-botines mr-2" />
            Editar negocio
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <i className="fas fa-times" />
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">{usuario.negocio_nombre}</p>

        <form onSubmit={guardar} className="space-y-3">
          <label className="flex items-start gap-2 cursor-pointer bg-blue-50 border border-blue-200 rounded-lg px-3 py-3">
            <input
              type="checkbox"
              checked={alquilaCanchas}
              onChange={e => setAlquilaCanchas(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-botines"
            />
            <span className="text-xs text-blue-900">
              <span className="font-semibold">El bot toma reservas automáticas</span>
              <span className="block text-blue-700 mt-0.5">
                Si está desactivado, el bot no muestra los flujos de reserva y deriva al dueño por WhatsApp.
              </span>
            </span>
          </label>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">
              Teléfono del dueño {!alquilaCanchas && <span className="text-red-500">*</span>}
            </label>
            <input
              value={telefono}
              onChange={e => setTelefono(e.target.value)}
              placeholder='Sin "+", ej: 5491123456789'
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-botines font-mono"
            />
            <p className="text-xs text-gray-400 mt-1">
              Se usa como link wa.me/&lt;telefono&gt; cuando el bot no maneja reservas automáticas.
            </p>
          </div>

          {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button
              type="button" onClick={onClose}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-lg text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit" disabled={guardando}
              className="flex-1 bg-botines hover:bg-green-700 disabled:bg-gray-300 text-white font-bold py-2.5 rounded-lg text-sm"
            >
              {guardando ? <><i className="fas fa-circle-notch fa-spin mr-2" />Guardando...</> : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
