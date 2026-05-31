// Прийоми та Управління Роботами (Без ручного введення цін)
const AppointmentsModule = {
    detailContext: null,
    _appointments: [],
    _sort: { field: 'id', dir: 'asc' },

    render() {
        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h2 class="text-primary fw-bold">Прийоми</h2>
                <button class="btn btn-success shadow-sm" onclick="app.showAppointmentForm()">Створити прийом</button>
            </div>
            <div id="appointmentForm"></div>
            <div id="appointmentsList"><p class="text-muted text-center py-4">Завантаження...</p></div>
        `;
        API.getAppointments().then(appointments => this.renderList(appointments))
           .catch(err => document.getElementById('appointmentsList').innerHTML = '<div class="alert alert-danger">Помилка при завантаженні</div>');
    },
    
    renderList(appointments) {
        const list = document.getElementById('appointmentsList');
        const data = (appointments || []).slice();
        data.sort((a,b) => {
            const f = this._sort.field;
            const dir = this._sort.dir === 'asc' ? 1 : -1;
            let va = f==='patient' ? (a.request?.patient?.full_name||'') : (f==='doctor' ? (a.request?.doctor?.full_name||'') : a.id);
            let vb = f==='patient' ? (b.request?.patient?.full_name||'') : (f==='doctor' ? (b.request?.doctor?.full_name||'') : b.id);
            if (typeof va === 'string') va = va.toLowerCase();
            if (typeof vb === 'string') vb = vb.toLowerCase();
            if (va < vb) return -1 * dir;
            if (va > vb) return 1 * dir;
            return 0;
        });
        if (!appointments || appointments.length === 0) {
            list.innerHTML = '<div class="alert alert-light text-center border">Немає прийомів</div>';
            return;
        }
        
        let html = '<div class="card shadow-sm border-0"><table class="table table-hover mb-0">';
        html += '<thead class="table-light"><tr><th>ID</th><th>Пацієнт</th><th>Лікар</th><th>Примітки</th><th class="text-end">Дії</th></tr></thead><tbody>';
        
        data.forEach(a => {
            html += `
                <tr class="align-middle">
                    <td>#${a.id}</td>
                    <td class="fw-bold">${a.request?.patient?.full_name || '-'}</td>
                    <td>${a.request?.doctor?.full_name || '-'}</td>
                    <td class="text-muted small">${a.notes || '-'}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-info me-2" onclick="app.editAppointment(${a.id})">Редагувати</button>
                        <button class="btn btn-sm btn-primary shadow-sm" onclick="AppointmentsModule.showDetail(${a.id})">Керувати прийомом</button>
                    </td>
                </tr>
            `;
        });
        html += '</tbody></table></div>';
        list.innerHTML = html;
    },

    sortBy(field) {
        if (this._sort.field === field) {
            this._sort.dir = this._sort.dir === 'asc' ? 'desc' : 'asc';
        } else {
            this._sort.field = field;
            this._sort.dir = 'asc';
        }
        this.renderList(this._appointments);
    },
    
    showForm(appointmentId = null) {
        const formDiv = document.getElementById('appointmentForm');
        const focusForm = () => formDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
        Promise.all([API.getRequests(), appointmentId ? API.getAppointment(appointmentId) : Promise.resolve(null)])
            .then(([requests, appointment]) => {
                let requestOptions = '<option value="">Виберіть заявку</option>';
                requests.forEach(r => { requestOptions += `<option value="${r.id}" ${appointment?.request?.id === r.id ? 'selected' : ''}>Заявка #${r.id} - ${r.patient?.full_name}</option>`; });
                
                formDiv.innerHTML = `
                    <div class="card mt-4 shadow-sm border-0">
                        <div class="card-header bg-light"><h5 class="mb-0 text-primary">${appointment ? 'Редагувати' : 'Створити'} прийом</h5></div>
                        <div class="card-body">
                            <div id="appointmentFormError" class="alert alert-danger d-none"></div>
                            <form id="appointmentFormElement">
                                <div class="mb-3">
                                    <label class="form-label">Заявка (Пацієнт)</label>
                                    <select class="form-select" name="request_id" required>${requestOptions}</select>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label">Примітки лікаря</label>
                                    <textarea class="form-control" name="notes" rows="3">${appointment?.notes || ''}</textarea>
                                </div>
                                <button type="submit" class="btn btn-primary px-4">Зберегти</button>
                                <button type="button" class="btn btn-light ms-2 px-4" onclick="app.hideForm()">Скасувати</button>
                            </form>
                        </div>
                    </div>
                `;
                
                document.getElementById('appointmentFormElement').addEventListener('submit', (e) => {
                    e.preventDefault();
                    const errorBox = document.getElementById('appointmentFormError');
                    errorBox.classList.add('d-none');
                    errorBox.innerHTML = '';

                    const data = { request_id: parseInt(e.target.request_id.value), notes: e.target.notes.value };
                    if (appointment) {
                        data.version = appointment.version;
                    }

                    const showError = (error) => {
                        const payload = error?.payload || {};
                        const messages = [];

                        if (error?.status === 409) {
                            messages.push("Цей запис уже оновився в іншій вкладці. Оновіть сторінку і спробуйте ще раз.");
                        }
                        if (payload.request_id) {
                            messages.push(`Заявка: ${Array.isArray(payload.request_id) ? payload.request_id.join(', ') : payload.request_id}`);
                        }
                        if (payload.notes) {
                            messages.push(`Примітки: ${Array.isArray(payload.notes) ? payload.notes.join(', ') : payload.notes}`);
                        }
                        if (!messages.length && error?.message) {
                            messages.push(error.message);
                        }

                        const title = error?.status === 409 ? 'Конфлікт оновлення' : 'Перевірте дані';
                        errorBox.innerHTML = `<strong>${title}</strong><br>${messages.map(message => `<div>${message}</div>`).join('')}`;
                        errorBox.classList.remove('d-none');
                    };

                    const requestPromise = appointment ? API.updateAppointment(appointment.id, data) : API.createAppointment(data);
                    requestPromise.then(() => { this.render(); app.hideForm(); }).catch(err => {
                        console.error(err);
                        showError(err);
                    });
                });
                focusForm();
            }).catch(err => formDiv.innerHTML = '<div class="alert alert-danger">Помилка завантаження</div>');
    },

    showDetail(id, focusOptions = null) {
        const appContainer = document.getElementById('app');
        appContainer.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';

        Promise.all([
            API.getAppointment(id),
            API.getWorkCategories(),
            API.getMaterialCategories(),
            API.getMedicineCategories(),
            API.getProcedureCategories()
        ]).then(([appt, works, materials, medicines, procedures]) => {

            this.detailContext = {
                appointmentId: appt.id,
                workOptions: works,
                materialOptions: materials,
                medicineOptions: medicines,
                procedureOptions: procedures,
            };

            const workOpts = works.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
            const worksHtml = this.renderWorksContainer(appt);

            appContainer.innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h2 class="text-primary fw-bold">Керування прийомом #${appt.id}</h2>
                    <button class="btn btn-outline-secondary" onclick="AppointmentsModule.render()">← Назад до списку</button>
                </div>
                
                <div class="card mb-4 bg-light border-0 shadow-sm">
                    <div class="card-body p-4">
                        <h4 class="mb-1 text-dark">Пацієнт: <strong>${appt.request?.patient?.full_name}</strong></h4>
                        <p class="mb-0 text-muted">Лікар: ${appt.request?.doctor?.full_name} | Дата: ${new Date(appt.request?.datetime).toLocaleString('uk-UA')}</p>
                        ${appt.notes ? `<p class="mt-2 mb-0 border-top pt-2 text-dark"><strong>Нотатки лікаря:</strong> ${appt.notes}</p>` : ''}
                    </div>
                </div>

                <div id="works-section" class="mb-4">
                    <h5 class="text-dark fw-bold mb-3">Виконані роботи та витрати:</h5>
                    <div id="works-container">${worksHtml}</div>
                </div>

                <div id="add-work-section" class="card border-0 shadow-sm bg-light mb-5">
                    <div class="card-body p-4">
                        <h5 class="text-primary fw-bold mb-3">Додати роботу</h5>
                        <form onsubmit="AppointmentsModule.addWork(event, ${appt.id})" class="row g-2 align-items-center">
                            <div class="col-md-9">
                                <select class="form-select" name="work_category" required>
                                    <option value="">Оберіть роботу зі списку...</option>
                                    ${workOpts}
                                </select>
                            </div>
                            <div class="col-md-3">
                                <button type="submit" class="btn btn-success w-100 shadow-sm">Зберегти роботу</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;

            this.focusAfterRefresh(focusOptions);
        }).catch(err => {
            console.error(err);
            appContainer.innerHTML = '<div class="alert alert-danger">Помилка завантаження даних прийому.</div>';
        });
    },

    renderWorksContainer(appointment) {
        if (!appointment.works || appointment.works.length === 0) {
            return '<div id="works-empty" class="alert alert-light text-center py-4 border text-muted">У цьому прийомі ще не виконано жодної роботи.</div>';
        }
        return appointment.works.map(work => this.buildWorkCard(work, appointment.id)).join('');
    },

    buildWorkCard(work, appointmentId) {
        const materialOptions = this.detailContext.materialOptions
            .map(m => `<option value="${m.id}">${m.name}</option>`)
            .join('');
        const medicineOptions = this.detailContext.medicineOptions
            .map(m => `<option value="${m.id}">${m.name}</option>`)
            .join('');
        const procedureOptions = this.detailContext.procedureOptions
            .map(p => `<option value="${p.id}">${p.name}</option>`)
            .join('');

        return `
            <div id="work-card-${work.id}" class="card mb-4 border-info shadow-sm bg-light bg-opacity-50">
                <div class="card-header bg-white d-flex justify-content-between align-items-center py-3 border-bottom border-info border-opacity-25">
                    <h6 class="mb-0 fw-bold text-primary">${work.category_name}</h6>
                    <div class="d-flex gap-2">
                        <span class="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25">Ціна: ${work.price} ₴</span>
                        <span class="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25">Витрати: ${work.cost} ₴</span>
                        <span class="badge bg-primary">Прибуток: ${work.profit} ₴</span>
                    </div>
                </div>
                <div class="card-body">
                    <div class="row g-4 align-items-stretch">
                        <div class="col-12 col-lg-4">
                            <div class="p-2 bg-white rounded border shadow-sm h-100">
                                <h6 class="text-muted small text-uppercase fw-bold border-bottom pb-1 mb-2">Матеріали</h6>
                                <ul class="list-group list-group-flush mb-2">${this.renderConsumablesList(work.materials, 'mat', work.id, appointmentId)}</ul>
                                <form onsubmit="AppointmentsModule.addConsumable(event, 'mat', ${work.id}, ${appointmentId})" class="mt-2 border-top pt-2">
                                    <select class="form-select form-select-sm mb-1" name="cat" required><option value="">+ Обрати матеріал</option>${materialOptions}</select>
                                    <input type="number" class="form-control form-control-sm mb-1" name="qty" placeholder="Кількість" required min="1" value="1">
                                    <button type="submit" class="btn btn-sm btn-outline-success w-100">Додати</button>
                                </form>
                            </div>
                        </div>
                        <div class="col-12 col-lg-4">
                            <div class="p-2 bg-white rounded border shadow-sm h-100">
                                <h6 class="text-muted small text-uppercase fw-bold border-bottom pb-1 mb-2">Ліки</h6>
                                <ul class="list-group list-group-flush mb-2">${this.renderConsumablesList(work.medicines, 'med', work.id, appointmentId)}</ul>
                                <form onsubmit="AppointmentsModule.addConsumable(event, 'med', ${work.id}, ${appointmentId})" class="mt-2 border-top pt-2">
                                    <select class="form-select form-select-sm mb-1" name="cat" required><option value="">+ Обрати ліки</option>${medicineOptions}</select>
                                    <input type="number" class="form-control form-control-sm mb-1" name="qty" placeholder="Кількість" required min="1" value="1">
                                    <button type="submit" class="btn btn-sm btn-outline-success w-100">Додати</button>
                                </form>
                            </div>
                        </div>
                        <div class="col-12 col-lg-4">
                            <div class="p-2 bg-white rounded border shadow-sm h-100">
                                <h6 class="text-muted small text-uppercase fw-bold border-bottom pb-1 mb-2">Супутні процедури</h6>
                                <ul class="list-group list-group-flush mb-2">${this.renderConsumablesList(work.procedures, 'proc', work.id, appointmentId)}</ul>
                                <form onsubmit="AppointmentsModule.addConsumable(event, 'proc', ${work.id}, ${appointmentId})" class="mt-2 border-top pt-2">
                                    <select class="form-select form-select-sm mb-1" name="cat" required><option value="">+ Обрати процедуру</option>${procedureOptions}</select>
                                    <button type="submit" class="btn btn-sm btn-outline-success w-100 mt-1">Додати</button>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderConsumablesList(items, type, workId, appointmentId) {
        if (!items || !items.length) {
            return '<p class="small text-muted mb-2 fst-italic">Немає записів</p>';
        }

        return items.map(item => `
            <li class="list-group-item d-flex justify-content-between align-items-center bg-white border rounded py-1 px-2 mb-1">
                <div class="small me-2">
                    <div>${item.category_name}</div>
                    <div class="text-muted">${item.quantity ? `<b>${item.quantity} шт.</b>` : 'Без кількості'}</div>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <span class="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-10">${item.cost} грн</span>
                    ${window.IS_ADMIN ? this.renderConsumableActions(type, item, workId, appointmentId) : ''}
                </div>
            </li>
        `).join('');
    },

    renderConsumableActions(type, item, workId, appointmentId) {
        const editButton = type === 'proc' ? '' : `
            <button type="button" class="btn btn-sm btn-outline-primary" onclick="AppointmentsModule.editConsumable('${type}', ${item.id}, ${workId}, ${appointmentId}, '${item.quantity ?? ''}', ${item.version || 1})">
                Редагувати
            </button>
        `;

        return `
            <div class="consumable-actions d-flex flex-wrap gap-1 justify-content-end">
                ${editButton}
                <button type="button" class="btn btn-sm btn-outline-danger" onclick="AppointmentsModule.deleteConsumable('${type}', ${item.id}, ${workId}, ${appointmentId})">
                    Видалити
                </button>
            </div>
        `;
    },

    editConsumable(type, id, workId, appointmentId, currentQuantity, version) {
        if (type === 'proc') {
            alert('Для процедур зараз доступне лише видалення.');
            return;
        }

        const newQuantity = prompt('Нова кількість', currentQuantity || '');
        if (newQuantity === null) {
            return;
        }

        const parsedQuantity = Number(newQuantity);
        if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
            alert('Кількість має бути числом більше 0');
            return;
        }

        let requestPromise;
        if (type === 'mat') {
            requestPromise = API.updateWorkMaterial(id, { quantity: parsedQuantity, version });
        } else if (type === 'med') {
            requestPromise = API.updateWorkMedicine(id, { quantity: parsedQuantity, version });
        }

        requestPromise
            .then(() => this.refreshWorkCard(appointmentId, workId))
            .catch(err => {
                console.error(err);
                if (err?.status === 409) {
                    alert('Цей запис уже оновився в іншій вкладці. Оновіть сторінку і спробуйте ще раз.');
                    return;
                }
                alert(err?.message || 'Помилка при оновленні запису');
            });
    },

    deleteConsumable(type, id, workId, appointmentId) {
        const confirmed = confirm('Видалити запис? Перерахунок витрат виконається автоматично.');
        if (!confirmed) {
            return;
        }

        let requestPromise;
        if (type === 'mat') {
            requestPromise = API.deleteWorkMaterial(id);
        } else if (type === 'med') {
            requestPromise = API.deleteWorkMedicine(id);
        } else if (type === 'proc') {
            requestPromise = API.deleteWorkProcedure(id);
        }

        requestPromise
            .then(() => this.refreshWorkCard(appointmentId, workId))
            .catch(err => {
                console.error(err);
                if (err?.status === 409) {
                    alert('Цей запис уже оновився в іншій вкладці. Оновіть сторінку і спробуйте ще раз.');
                    return;
                }
                alert(err?.message || 'Помилка при видаленні запису');
            });
    },

    refreshWorkCard(appointmentId, workId) {
        return API.getAppointment(appointmentId).then(appointment => {
            const work = appointment.works?.find(item => item.id === workId);
            if (!work) {
                this.showDetail(appointmentId, { workId });
                return;
            }

            const existingCard = document.getElementById(`work-card-${workId}`);
            if (!existingCard) {
                this.showDetail(appointmentId, { workId });
                return;
            }

            existingCard.outerHTML = this.buildWorkCard(work, appointmentId);
            this.focusAfterRefresh({ workId });
        });
    },

    appendNewWorkCard(appointmentId, workId) {
        return API.getAppointment(appointmentId).then(appointment => {
            const work = appointment.works?.find(item => item.id === workId);
            if (!work) {
                this.showDetail(appointmentId, { workId, section: 'add-work' });
                return;
            }

            const worksContainer = document.getElementById('works-container');
            if (!worksContainer) {
                this.showDetail(appointmentId, { workId, section: 'add-work' });
                return;
            }

            const emptyState = document.getElementById('works-empty');
            if (emptyState) {
                emptyState.remove();
            }

            worksContainer.insertAdjacentHTML('beforeend', this.buildWorkCard(work, appointmentId));
            this.focusAfterRefresh({ workId });
        });
    },

    focusAfterRefresh(focusOptions) {
        if (!focusOptions) {
            return;
        }

        requestAnimationFrame(() => {
            let targetElement = null;

            if (focusOptions.workId) {
                targetElement = document.getElementById(`work-card-${focusOptions.workId}`);
            }

            if (!targetElement && focusOptions.section === 'add-work') {
                targetElement = document.getElementById('add-work-section');
            }

            if (targetElement) {
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        });
    },

    addWork(event, appointmentId) {
        event.preventDefault();
        const data = {
            appointment: appointmentId,
            work_category: parseInt(event.target.work_category.value)
        };
        
        API.createAppointmentWork(data)
            .then(createdWork => {
                if (!createdWork?.id) {
                    this.showDetail(appointmentId, { section: 'add-work' });
                    return;
                }
                this.appendNewWorkCard(appointmentId, createdWork.id);
                event.target.reset();
            })
            .catch(err => alert('Помилка при додаванні роботи!'));
    },

    addConsumable(event, type, workId, appointmentId) {
        event.preventDefault();
        const form = event.target;
        const categoryId = parseInt(form.cat.value);
        
        let apiCall;
        
        if (type === 'mat') {
            apiCall = API.createWorkMaterial({ appointment_work: workId, category: categoryId, quantity: parseInt(form.qty.value) });
        } else if (type === 'med') {
            apiCall = API.createWorkMedicine({ appointment_work: workId, category: categoryId, quantity: parseInt(form.qty.value) });
        } else if (type === 'proc') {
            apiCall = API.createWorkProcedure({ appointment_work: workId, category: categoryId });
        }

        apiCall.then(() => this.refreshWorkCard(appointmentId, workId))
        .catch(err => {
            console.error(err);
            alert('Помилка при збереженні витрат!');
        });
    }
};

console.log('AppointmentsModule завантажений');