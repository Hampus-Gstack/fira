// Fira API client — thin fetch wrapper over the invite/RSVP backend.
(function () {
  const BASE = window.FIRA_CONFIG.API_BASE;

  async function req(path, opts = {}) {
    const res = await fetch(BASE + path, {
      headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
      ...opts,
    });
    if (!res.ok) {
      let detail = "";
      try { detail = (await res.json()).detail || ""; } catch (e) {}
      const err = new Error(detail || "Request failed (" + res.status + ")");
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  window.FiraAPI = {
    createInvite: (data) =>
      req("/invites", { method: "POST", body: JSON.stringify({ data }) }),
    getInvite: (id) => req("/invites/" + encodeURIComponent(id)),
    updateInvite: (id, data, adminKey) =>
      req("/invites/" + encodeURIComponent(id), {
        method: "PUT",
        body: JSON.stringify({ data }),
        headers: { "X-Admin-Key": adminKey },
      }),
    deleteInvite: (id, adminKey) =>
      req("/invites/" + encodeURIComponent(id), {
        method: "DELETE",
        headers: { "X-Admin-Key": adminKey },
      }),
    sendRsvp: (id, rsvp) =>
      req("/invites/" + encodeURIComponent(id) + "/rsvp", {
        method: "POST",
        body: JSON.stringify(rsvp),
      }),
    listRsvps: (id, adminKey) =>
      req("/invites/" + encodeURIComponent(id) + "/rsvps", {
        headers: { "X-Admin-Key": adminKey },
      }),
  };

  // Local registry of invitations this browser created ("My invitations").
  const LS_KEY = "fira_my_invites";
  window.FiraVault = {
    all() {
      try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; } catch (e) { return []; }
    },
    save(entry) {
      const list = this.all().filter((e) => e.id !== entry.id);
      list.unshift(entry);
      try { localStorage.setItem(LS_KEY, JSON.stringify(list.slice(0, 50))); } catch (e) {}
    },
    remove(id) {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(this.all().filter((e) => e.id !== id)));
      } catch (e) {}
    },
    get(id) { return this.all().find((e) => e.id === id) || null; },
  };
})();
