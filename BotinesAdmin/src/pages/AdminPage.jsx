import { useState, useEffect, useCallback } from "react";

const ADMIN_KEY = "botines_admin_secret";

// ─── API helpers ─────────────────────────────────────────────────────────────

async function apiAdmin(method, path, secret, body = null) {
  const res = await fetch(`/api/auth${path}`, {
    method,
    headers: {
      "Content-Type":  "application/json",
      "X-Admin-Secret": secret,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
  return data;
}

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
    } catch {
      setErrorLogin("Secreto incorrecto");
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

function PanelAdmin({ secret, onCerrar }) {
  const [usuarios,    setUsuarios]    = useState([]);
  const [cargando,    setCargando]    = useState(true);
  const [form,        setForm]        = useState({ negocioNombre: "", usuario: "", password: "", nombre: "" });
  const [enviando,    setEnviando]    = useState(false);
  const [exito,       setExito]       = useState("");
  const [error,       setError]       = useState("");

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

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setExito("");
    if (!form.negocioNombre || !form.usuario || !form.password || !form.nombre) {
      setError("Completá todos los campos"); return;
    }
    setEnviando(true);
    try {
      const data = await apiAdmin("POST", "/setup", secret, form);
      setExito(`✅ Negocio "${data.negocio.nombre}" y usuario "${data.usuario.usuario}" creados correctamente`);
      setForm({ negocioNombre: "", usuario: "", password: "", nombre: "" });
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
                <div key={u.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{u.negocio_nombre}</p>
                    <p className="text-xs text-gray-500">@{u.usuario} · {u.nombre}</p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(u.created_at).toLocaleDateString("es-AR")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
