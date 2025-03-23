class ConfirmCodeDto {
    constructor(data = {}) {
        // Инициализация полей значениями по умолчанию
        this._requestId = null;
        this._userId = null;
        this._verificationCode = null;
        this._attempts = 0;
        this._status = 'PENDING';
        this._created = new Date().toISOString();
        this._updated = new Date().toISOString();
        this._blocked = new Date().toISOString();

        // Если передан объект data, заполняем поля
        if (data) {
            this.setRequestId(data.request_id || data.requestId || null);
            this.setUserId(data.user_id || data.userId || null);
            this.setVerificationCode(data.verification_code || data.verificationCode || null);
            this.setAttempts(data.attempts || 0);
            this.setStatus(data.status || 'PENDING');
            this.setCreated(data.created || new Date().toISOString());
            this.setUpdated(data.updated || new Date().toISOString());
            this.setBlocked(data.blocked || new Date().toISOString());
        }
    }

    // Геттеры
    getRequestId() {
        return this._requestId;
    }

    getUserId() {
        return this._userId;
    }

    getVerificationCode() {
        return this._verificationCode;
    }

    getAttempts() {
        return this._attempts;
    }

    getStatus() {
        return this._status;
    }

    getCreated() {
        return this._created;
    }

    getUpdated() {
        return this._updated;
    }

    getBlocked() {
        return this._blocked;
    }

    // Сеттеры
    setRequestId(value) {
        if (typeof value === 'string' && value.length === 36) {
            this._requestId = value;
        } else {
            throw new Error('Invalid requestId. It must be a string of 36 characters.');
        }
    }

    setUserId(value) {
        if (typeof value === 'number' && value > 0) {
            this._userId = value;
        } else {
            throw new Error('Invalid userId. It must be a positive number.');
        }
    }

    setVerificationCode(value) {
        if (typeof value === 'number' && value >= 0) {
            this._verificationCode = value;
        } else {
            throw new Error('Invalid verificationCode. It must be a non-negative number.');
        }
    }

    setAttempts(value) {
        if (typeof value === 'number' && value >= 0) {
            this._attempts = value;
        } else {
            throw new Error('Invalid attempts. It must be a non-negative number.');
        }
    }

    setStatus(value) {
        const allowedStatuses = ['PENDING', 'SUCCESS', 'FAILED'];
        if (allowedStatuses.includes(value)) {
            this._status = value;
        } else {
            throw new Error(`Invalid status. Allowed values are: ${allowedStatuses.join(', ')}`);
        }
    }

    setCreated(value) {
        if (value instanceof Date || !isNaN(new Date(value).getTime())) {
            this._created = new Date(value).toISOString();
        } else {
            throw new Error('Invalid created date.');
        }
    }

    setUpdated(value) {
        if (value instanceof Date || !isNaN(new Date(value).getTime())) {
            this._updated = new Date(value).toISOString();
        } else {
            throw new Error('Invalid updated date.');
        }
    }

    setBlocked(value) {
        if (value instanceof Date || !isNaN(new Date(value).getTime())) {
            this._blocked = new Date(value).toISOString();
        } else {
            throw new Error('Invalid blocked date.');
        }
    }

    // Метод для преобразования объекта в plain object (опционально)
    toObject() {
        return {
            requestId: this._requestId,
            userId: this._userId,
            verificationCode: this._verificationCode,
            attempts: this._attempts,
            status: this._status,
            created: this._created,
            updated: this._updated,
            blocked: this._blocked,
        };
    }
}