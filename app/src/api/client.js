const BASE = import.meta.env.VITE_API_URL || '/api';

async function request(path, options = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error desconocido');
  return data;
}

async function requestEmpty(path, options = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Error desconocido');
  }
}

export const api = {
  auth: {
    register:      (body) => request('/auth/register', { method: 'POST',  body: JSON.stringify(body) }),
    login:         (body) => request('/auth/login',    { method: 'POST',  body: JSON.stringify(body) }),
    me:            ()     => request('/auth/me'),
    updateProfile: (body) => request('/auth/profile',  { method: 'PATCH', body: JSON.stringify(body) }),
    activity:      ()     => request('/auth/activity'),
  },

  admin: {
    users:        ()           => request('/admin/users'),
    pendingCount: ()           => request('/admin/pending-count'),
    setStatus:    (id, status) => request(`/admin/users/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    setRole:      (id, role)   => request(`/admin/users/${id}/role`,   { method: 'PATCH', body: JSON.stringify({ role }) }),
    userActivity: (id)         => request(`/admin/users/${id}/activity`),
  },


  experiments: {
    list:    (params = {}) => request(`/experiments?${new URLSearchParams(params)}`),
    get:     (id)          => request(`/experiments/${id}`),
    create:  (body)        => request('/experiments',       { method: 'POST',  body: JSON.stringify(body) }),
    update:  (id, body)    => request(`/experiments/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    archive: (id, state)   => request(`/experiments/${id}/archive`, { method: 'PATCH', body: JSON.stringify({ state }) }),

    addStep:    (id, body)         => request(`/experiments/${id}/steps`, { method: 'POST',   body: JSON.stringify(body) }),
    updateStep: (id, stepId, body) => request(`/experiments/${id}/steps/${stepId}`, { method: 'PATCH', body: JSON.stringify(body) }),
    deleteStep: (id, stepId)       => requestEmpty(`/experiments/${id}/steps/${stepId}`, { method: 'DELETE' }),

    addComment:    (id, body)      => request(`/experiments/${id}/comments`, { method: 'POST', body: JSON.stringify({ body }) }),
    deleteComment: (id, commentId) => requestEmpty(`/experiments/${id}/comments/${commentId}`, { method: 'DELETE' }),

    addLink:       (id, resource_id, quantity_used) => requestEmpty(`/experiments/${id}/links`, { method: 'POST',   body: JSON.stringify({ resource_id, quantity_used }) }),
    removeLink: (id, resource_id) => requestEmpty(`/experiments/${id}/links/${resource_id}`, { method: 'DELETE' }),

    listDatasets:  (id)       => request(`/experiments/${id}/datasets`),
    createDataset: (id, body) => request(`/experiments/${id}/datasets`, { method: 'POST', body: JSON.stringify(body) }),
  },

  datasets: {
    get:          (id)            => request(`/datasets/${id}`),
    update:       (id, body)      => request(`/datasets/${id}`,           { method: 'PATCH',  body: JSON.stringify(body) }),
    delete:       (id)            => requestEmpty(`/datasets/${id}`,      { method: 'DELETE' }),
    setCompounds: (id, compounds) => request(`/datasets/${id}/compounds`, { method: 'POST',   body: JSON.stringify({ compounds }) }),
    setColumns:   (id, columns)   => request(`/datasets/${id}/columns`,   { method: 'PATCH',  body: JSON.stringify({ columns }) }),
    addRow:       (id, body)      => request(`/datasets/${id}/rows`,      { method: 'POST',   body: JSON.stringify(body) }),
    deleteRow:    (id, rowId)     => requestEmpty(`/datasets/${id}/rows/${rowId}`, { method: 'DELETE' }),
    exportExcel:  (id) => {
      const token = localStorage.getItem('token');
      return fetch(`${BASE}/datasets/${id}/export`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
    },
    importExcel: (id, file) => {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', file);
      return fetch(`${BASE}/datasets/${id}/import`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      }).then(async r => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'Error al importar');
        return data;
      });
    },
  },

  templates: {
    list:   ()         => request('/templates'),
    get:    (id)       => request(`/templates/${id}`),
    create: (body)     => request('/templates',       { method: 'POST',   body: JSON.stringify(body) }),
    update: (id, body) => request(`/templates/${id}`, { method: 'PATCH',  body: JSON.stringify(body) }),
    delete: (id)       => requestEmpty(`/templates/${id}`, { method: 'DELETE' }),
  },

  resources: {
    list:    (params = {}) => request(`/resources?${new URLSearchParams(params)}`),
    get:     (id)          => request(`/resources/${id}`),
    create:  (body)        => request('/resources',       { method: 'POST',  body: JSON.stringify(body) }),
    update:  (id, body)    => request(`/resources/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    archive: (id, state)   => request(`/resources/${id}/archive`, { method: 'PATCH', body: JSON.stringify({ state }) }),
    bulkImport: (items)    => request('/resources/bulk',  { method: 'POST',  body: JSON.stringify({ items }) }),
    categories: {
      list:   ()         => request('/resources/categories'),
      create: (body)     => request('/resources/categories',       { method: 'POST',   body: JSON.stringify(body) }),
      update: (id, body) => request(`/resources/categories/${id}`, { method: 'PATCH',  body: JSON.stringify(body) }),
      delete: (id)       => requestEmpty(`/resources/categories/${id}`, { method: 'DELETE' }),
    },
  },

  locations: {
    list:   ()         => request('/resources/locations'),
    create: (body)     => request('/resources/locations',       { method: 'POST',   body: JSON.stringify(body) }),
    update: (id, body) => request(`/resources/locations/${id}`, { method: 'PATCH',  body: JSON.stringify(body) }),
    delete: (id)       => requestEmpty(`/resources/locations/${id}`, { method: 'DELETE' }),
  },

  publications: {
    list:              (params = {}) => request(`/publications?${new URLSearchParams(params)}`),
    get:               (id)          => request(`/publications/${id}`),
    create:            (body)        => request('/publications',       { method: 'POST',   body: JSON.stringify(body) }),
    update:            (id, body)    => request(`/publications/${id}`, { method: 'PATCH',  body: JSON.stringify(body) }),
    delete:            (id)          => requestEmpty(`/publications/${id}`, { method: 'DELETE' }),
    linkDataset:       (id, dataset_id)   => requestEmpty(`/publications/${id}/datasets`, { method: 'POST',   body: JSON.stringify({ dataset_id }) }),
    unlinkDataset:     (id, dataset_id)   => requestEmpty(`/publications/${id}/datasets/${dataset_id}`, { method: 'DELETE' }),
    availableDatasets: (id)               => request(`/publications/${id}/available-datasets`),
    wosSearch:         ()            => request('/publications/wos'),
    wosImport:         (body)        => request('/publications/wos-import', { method: 'POST', body: JSON.stringify(body) }),
  },
};
