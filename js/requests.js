// Заявки
const RequestsModule = {
    _requests: [],
    _sort: { field: 'datetime', dir: 'asc' },

    render() {
        const app = document.getElementById('app');
        
        app.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-4">
                <h2>Заявки</h2>
                <button class="btn btn-success" onclick="app.showRequestForm()">Додати</button>
            </div>
            
            <div id="requestForm"></div>
            <div id="requestsList"><p class="text-muted">Завантаження...</p></div>
        `;
        
        API.getRequests().then(requests => {
            this._requests = requests || [];
            this.renderList(this._requests);
        }).catch(err => {
            console.error('Error loading requests:', err);
            document.getElementById('requestsList').innerHTML = '<p class="text-danger">Помилка при завантаженні</p>';
        });
    },
    
    renderList(requests) {
        const list = document.getElementById('requestsList');
        
        const data = (requests || []).slice();
        data.sort((a,b) => {
            const f = this._sort.field;
            const dir = this._sort.dir === 'asc' ? 1 : -1;
            let va = (f==='patient' ? (a.patient?.full_name||'') : (f==='doctor' ? (a.doctor?.full_name||'') : a.datetime));
            let vb = (f==='patient' ? (b.patient?.full_name||'') : (f==='doctor' ? (b.doctor?.full_name||'') : b.datetime));
            if (typeof va === 'string') va = va.toLowerCase();
            if (typeof vb === 'string') vb = vb.toLowerCase();
            if (va < vb) return -1 * dir;
            if (va > vb) return 1 * dir;
            return 0;
        });

        if (!data || data.length === 0) {
            list.innerHTML = '<p class="text-muted">Немає заявок</p>';
            return;
        }
        
        let html = '<table class="table table-striped">';
        html += `<thead><tr><th style="cursor:pointer" onclick="RequestsModule.sortBy('patient')">Пацієнт ${this._sort.field==='patient'?(this._sort.dir==='asc'?'▲':'▼'):''}</th><th style="cursor:pointer" onclick="RequestsModule.sortBy('datetime')">Дата/час ${this._sort.field==='datetime'?(this._sort.dir==='asc'?'▲':'▼'):''}</th><th style="cursor:pointer" onclick="RequestsModule.sortBy('doctor')">Лікар ${this._sort.field==='doctor'?(this._sort.dir==='asc'?'▲':'▼'):''}</th><th>Дії</th></tr></thead><tbody>`;
        
        data.forEach(r => {
            const doctorName = r.doctor?.full_name || 'Не призначено';
            html += `
                <tr>
                    <td>${r.patient?.full_name || '-'}</td>
                    <td>${new Date(r.datetime).toLocaleString('uk-UA')}</td>
                    <td>${doctorName}</td>
                    <td>
                        <button class="btn btn-sm btn-info" onclick="app.editRequest(${r.id})">Редагувати</button>
                        </td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        list.innerHTML = html;
    },

    sortBy(field) {
        if (this._sort.field === field) {
            this._sort.dir = this._sort.dir === 'asc' ? 'desc' : 'asc';
        } else {
            this._sort.field = field;
            this._sort.dir = 'asc';
        }
        this.renderList(this._requests);
    },
    
    showForm(requestId = null) {
        const formDiv = document.getElementById('requestForm');
        const focusForm = () => formDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        Promise.all([
            API.getPatients(), 
            API.getDoctors(), 
            requestId ? API.getRequest(requestId) : Promise.resolve(null)
        ])
            .then(([patients, doctors, request]) => {
                this.renderForm(patients, doctors, request, formDiv);
                focusForm();
            })
            .catch(err => {
                console.error('Error loading data:', err);
                formDiv.innerHTML = '<p class="text-danger">Помилка при завантаженні</p>';
            });
    },
    
    renderForm(patients, doctors, request, formDiv) {
        let patientOptions = '<option value="">Виберіть пацієнта</option>';
        patients.forEach(p => {
            patientOptions += `<option value="${p.id}" ${request?.patient?.id === p.id ? 'selected' : ''}>${p.full_name}</option>`;
        });
        
        // Генеруємо список лікарів для селекта
        let doctorOptions = '<option value="">Виберіть лікаря</option>';
        doctors.forEach(d => {
            doctorOptions += `<option value="${d.id}" ${request?.doctor?.id === d.id ? 'selected' : ''}>${d.full_name} (${d.specialization})</option>`;
        });
        
        const now = new Date().toISOString().slice(0, 16);
        const requestDateTime = request?.datetime
            ? new Date(new Date(request.datetime).getTime() - new Date(request.datetime).getTimezoneOffset() * 60000)
                .toISOString()
                .slice(0, 16)
            : now;
        
        let html = `
            <div class="card mt-4">
                <div class="card-header">
                    <h5>${request ? 'Редагувати' : 'Додати'} заявку</h5>
                </div>
                <div class="card-body">
                    <div id="requestFormError" class="alert alert-danger d-none"></div>
                    <form id="requestFormElement">
                        <div class="mb-3">
                            <label class="form-label">Пацієнт</label>
                            <select class="form-control" name="patient_id" required>
                                ${patientOptions}
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Лікар</label>
                            <select class="form-control" name="doctor_id" required>
                                ${doctorOptions}
                            </select>
                        </div>
                        <div class="mb-3">
                            <label class="form-label">Дата/час</label>
                            <input type="datetime-local" class="form-control" name="datetime" value="${requestDateTime}" required>
                        </div>
                        <button type="submit" class="btn btn-primary">Зберегти</button>
                        <button type="button" class="btn btn-secondary" onclick="app.hideForm()">Скасувати</button>
                    </form>
                </div>
            </div>
        `;
        
        formDiv.innerHTML = html;
        
        document.getElementById('requestFormElement').addEventListener('submit', (e) => {
            e.preventDefault();
            const form = e.target;
            const errorBox = document.getElementById('requestFormError');
            errorBox.classList.add('d-none');
            errorBox.innerHTML = '';

            const data = {
                patient_id: parseInt(form.patient_id.value),
                doctor_id: parseInt(form.doctor_id.value),
                datetime: form.datetime.value
            };
            
            const showError = (error) => {
                const payload = error?.payload || {};
                const messages = [];

                if (error?.status === 409) {
                    messages.push("Цей запис уже оновився в іншій вкладці. Оновіть сторінку і спробуйте ще раз.");
                }
                if (payload.datetime) {
                    messages.push(`Дата/час: ${Array.isArray(payload.datetime) ? payload.datetime.join(', ') : payload.datetime}`);
                }
                if (payload.patient_id) {
                    messages.push(`Пацієнт: ${Array.isArray(payload.patient_id) ? payload.patient_id.join(', ') : payload.patient_id}`);
                }
                if (payload.doctor_id) {
                    messages.push(`Лікар: ${Array.isArray(payload.doctor_id) ? payload.doctor_id.join(', ') : payload.doctor_id}`);
                }
                if (!messages.length && error?.message) {
                    messages.push(error.message);
                }

                const title = error?.status === 409 ? 'Конфлікт оновлення' : 'Перевірте дані';
                errorBox.innerHTML = `<strong>${title}</strong><br>${messages.map(message => `<div>${message}</div>`).join('')}`;
                errorBox.classList.remove('d-none');
            };

            if (request) {
                data.version = request.version;
                API.updateRequest(request.id, data).then(() => {
                    this.render();
                    app.hideForm();
                }).catch(err => {
                    console.error('Error updating request:', err);
                    showError(err);
                });
            } else {
                API.createRequest(data).then(() => {
                    this.render();
                    app.hideForm();
                }).catch(err => {
                    console.error('Error creating request:', err);
                    showError(err);
                });
            }
        });
    }
};

console.log('RequestsModule завантажений');