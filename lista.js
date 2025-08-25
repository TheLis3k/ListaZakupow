// ===== DATABASE MODULE =====
const DatabaseModule = (() => {
    const API_BASE_URL = 'https://stronakszona.pl/lista';
    let isOnline = true;

    // Check network status
    const checkNetworkStatus = () => {
        isOnline = navigator.onLine;
        return isOnline;
    };

    // Show appropriate error message based on error type
    const getErrorMessage = (error) => {
        if (!checkNetworkStatus()) {
            return 'Brak połączenia internetowego. Sprawdź swoje połączenie.';
        }
        
        if (error.message.includes('Failed to fetch')) {
            return 'Problem z połączeniem z serwerem. Spróbuj ponownie.';
        }
        
        if (error.message.includes('401')) {
            return 'Nieautoryzowany dostęp. Zaloguj się ponownie.';
        }
        
        if (error.message.includes('404')) {
            return 'Żądany zasób nie został znaleziony.';
        }
        
        if (error.message.includes('500')) {
            return 'Błąd serwera. Spróbuj ponownie później.';
        }
        
        return error.message || 'Wystąpił nieoczekiwany błąd.';
    };

    /**
     * Make API request to server with enhanced error handling
     */
    const apiRequest = async (endpoint, method = 'GET', data = null) => {
        // Check network status before making request
        if (!checkNetworkStatus()) {
            throw new Error('Brak połączenia internetowego');
        }

        try {
            const options = {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include'
            };

            if (data && (method === 'POST' || method === 'PUT')) {
                options.body = JSON.stringify(data);
            }

            const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.message || `HTTP error! status: ${response.status}`;
                throw new Error(errorMessage);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
            const userFriendlyMessage = getErrorMessage(error);
            throw new Error(userFriendlyMessage);
        }
    };

    // API methods
    const registerUser = async (username, password) => {
        return apiRequest('/register.php', 'POST', { username, password });
    };

    const loginUser = async (username, password) => {
        return apiRequest('/login.php', 'POST', { username, password });
    };

    const logoutUser = async () => {
        return apiRequest('/logout.php', 'POST');
    };

    const getShoppingList = async () => {
        return apiRequest('/items.php', 'GET');
    };

    const addItem = async (item) => {
        return apiRequest('/items.php', 'POST', item);
    };

    const updateItem = async (id, updates) => {
        return apiRequest(`/items.php?id=${id}`, 'PUT', updates);
    };

    const deleteItem = async (id) => {
        return apiRequest(`/items.php?id=${id}`, 'DELETE');
    };

    const removeCheckedItems = async () => {
        return apiRequest('/items.php?action=remove_checked', 'DELETE');
    };

    const clearList = async () => {
        return apiRequest('/items.php?action=clear', 'DELETE');
    };

    // New method to replace entire list
    const replaceShoppingList = async (items) => {
        return apiRequest('/items.php?action=replace', 'PUT', { items });
    };

    return {
        registerUser,
        loginUser,
        logoutUser,
        getShoppingList,
        addItem,
        updateItem,
        deleteItem,
        removeCheckedItems,
        clearList,
        replaceShoppingList,
        checkNetworkStatus
    };
})();

// ===== PASSWORD STRENGTH MODULE =====
const PasswordStrength = (() => {
    /**
     * Check password strength with detailed feedback
     */
    const checkStrength = (password) => {
        let strength = 0;
        let feedback = [];
        const requirements = {
            minLength: 8,
            hasLowercase: /[a-z]/.test(password),
            hasUppercase: /[A-Z]/.test(password),
            hasNumbers: /[0-9]/.test(password),
            hasSpecial: /[!,@,#,$,%,^,&,*,?,_,~]/.test(password)
        };

        // Length check
        if (password.length >= requirements.minLength) {
            strength += 1;
        } else {
            feedback.push('Hasło powinno mieć co najmniej 8 znaków');
        }
        
        // Contains both lowercase and uppercase
        if (requirements.hasLowercase && requirements.hasUppercase) {
            strength += 1;
        } else {
            feedback.push('Dodaj wielkie i małe litery');
        }
        
        // Contains numbers
        if (requirements.hasNumbers) {
            strength += 1;
        } else {
            feedback.push('Dodaj cyfry');
        }
        
        // Contains special characters
        if (requirements.hasSpecial) {
            strength += 1;
        } else {
            feedback.push('Dodaj znaki specjalne (!@#$%^&*?_~)');
        }
        
        // Determine strength level
        let strengthLevel = 'very-weak';
        if (strength >= 4) strengthLevel = 'strong';
        else if (strength >= 3) strengthLevel = 'medium';
        else if (strength >= 2) strengthLevel = 'weak';
        
        return { 
            strength: strengthLevel, 
            feedback: feedback.length > 0 ? feedback.join('. ') : 'Mocne hasło!',
            requirements
        };
    };
    
    return {
        checkStrength
    };
})();

// ===== SESSION MANAGEMENT =====
const SessionManager = (() => {
    const SESSION_KEY = 'shopping_list_session';
    const USER_KEY = 'shopping_list_user';
    const REMEMBER_ME_KEY = 'remember_me';
    
    /**
     * Save user session data with remember me preference
     * Uses localStorage for "remember me" and sessionStorage for temporary sessions
     */
    const saveSession = (userData, rememberMe = false) => {
        try {
            const sessionData = {
                user: userData,
                timestamp: Date.now(),
                rememberMe: rememberMe
            };
            
            if (rememberMe) {
                localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
                localStorage.setItem(USER_KEY, JSON.stringify(userData));
                sessionStorage.removeItem(SESSION_KEY);
            } else {
                sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
                localStorage.removeItem(SESSION_KEY);
            }
            
            localStorage.setItem(REMEMBER_ME_KEY, rememberMe.toString());
            return true;
        } catch (error) {
            console.error('Error saving session:', error);
            return false;
        }
    };
    
    /**
     * Get stored session data
     * Checks both sessionStorage and localStorage
     */
    const getSession = () => {
        try {
            // First check sessionStorage for temporary sessions
            let sessionData = sessionStorage.getItem(SESSION_KEY);
            if (sessionData) return JSON.parse(sessionData);
            
            // Then check localStorage for remembered sessions
            sessionData = localStorage.getItem(SESSION_KEY);
            return sessionData ? JSON.parse(sessionData) : null;
        } catch (error) {
            console.error('Error getting session:', error);
            return null;
        }
    };
    
    /**
     * Get stored user data
     */
    const getUser = () => {
        try {
            const session = getSession();
            return session ? session.user : null;
        } catch (error) {
            console.error('Error getting user:', error);
            return null;
        }
    };
    
    /**
     * Get remember me preference
     */
    const getRememberMe = () => {
        try {
            return localStorage.getItem(REMEMBER_ME_KEY) === 'true';
        } catch (error) {
            console.error('Error getting remember me preference:', error);
            return false;
        }
    };
    
    /**
     * Clear session data from both storage types
     */
    const clearSession = () => {
        try {
            sessionStorage.removeItem(SESSION_KEY);
            localStorage.removeItem(SESSION_KEY);
            localStorage.removeItem(USER_KEY);
            localStorage.removeItem(REMEMBER_ME_KEY);
            return true;
        } catch (error) {
            console.error('Error clearing session:', error);
            return false;
        }
    };
    
    /**
     * Check if session is still valid based on remember me preference
     * For "remember me" sessions, valid for 7 days
     * For temporary sessions, valid until browser is closed
     */
    const isSessionValid = () => {
        const session = getSession();
        if (!session) return false;
        
        const rememberMe = getRememberMe();
        
        // If remember me is enabled, session is valid for 7 days
        if (rememberMe) {
            const oneWeek = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
            return (Date.now() - session.timestamp) < oneWeek;
        }
        
        // If remember me is disabled, session is valid until browser is closed
        // Since we're using sessionStorage, it will automatically clear on browser close
        return true;
    };
    
    return {
        saveSession,
        getSession,
        getUser,
        getRememberMe,
        clearSession,
        isSessionValid
    };
})();

// ===== UTILITY FUNCTIONS =====
const Utils = (() => {
    /**
     * Escape HTML special characters to prevent XSS
     */
    const escapeHtml = (text) => {
        if (typeof text !== 'string') return text;
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    };
    
    /**
     * Debounce function to limit how often a function can be called
     */
    const debounce = (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    };
    
    /**
     * Format date to readable format
     */
    const formatDate = (dateString) => {
        if (!dateString) return '';
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString('pl-PL', options);
    };
    
    return {
        escapeHtml,
        debounce,
        formatDate
    };
})();

// ===== APPLICATION MODULE =====
const ShoppingListApp = (() => {
    // DOM Elements
    let elements = {};

    // Application state
    let currentUser = null;
    let shoppingList = [];
    let failedLoginAttempts = 0;
    const MAX_LOGIN_ATTEMPTS = 5;
    const LOCKOUT_TIME = 5 * 60 * 1000; // 5 minutes
    let lockoutUntil = 0;
    let isEditingMode = false;
    let originalList = [];

    // Initialize the application
    const init = () => {
        initializeElements();
        bindEvents();
        checkSavedSession();
        loadThemePreference();
        setupNetworkListener();
        prefillRememberMe();
    };

    // Initialize DOM elements
    const initializeElements = () => {
        elements = {
            btnEditList: document.getElementById('btn-edit-list'),
            btnRemoveChecked: document.getElementById('btn-remove-checked'),
            btnClearList: document.getElementById('btn-clear-list'),
            authSection: document.getElementById('auth-section'),
            appSection: document.getElementById('app-section'),
            currentUserSpan: document.getElementById('current-user'),
            loginTab: document.getElementById('login-tab'),
            registerTab: document.getElementById('register-tab'),
            tabs: document.querySelectorAll('.tab'),
            loginUsername: document.getElementById('login-username'),
            loginPassword: document.getElementById('login-password'),
            registerUsername: document.getElementById('register-username'),
            registerPassword: document.getElementById('register-password'),
            registerConfirm: document.getElementById('register-confirm'),
            btnLogin: document.getElementById('btn-login'),
            btnRegister: document.getElementById('btn-register'),
            btnLogout: document.getElementById('btn-logout'),
            newItemInput: document.getElementById('new-item'),
            newQuantityInput: document.getElementById('new-quantity'),
            newUnitSelect: document.getElementById('new-unit'),
            newDescriptionInput: document.getElementById('new-description'),
            btnAddItem: document.getElementById('btn-add-item'),
            shoppingItems: document.getElementById('shopping-items'),
            btnRefresh: document.getElementById('btn-refresh'),
            btnSaveChanges: document.getElementById('btn-save-changes'),
            btnCancelEdit: document.getElementById('btn-cancel-edit'),
            notification: document.getElementById('notification'),
            passwordStrengthBar: document.getElementById('password-strength-bar'),
            passwordFeedback: document.getElementById('password-feedback'),
            loginLoading: document.getElementById('login-loading'),
            registerLoading: document.getElementById('register-loading'),
            loginText: document.getElementById('login-text'),
            registerText: document.getElementById('register-text'),
            btnSettings: document.getElementById('btn-settings'),
            settingsPanel: document.getElementById('settings-panel'),
            settingsClose: document.querySelector('.settings-close'),
            overlay: document.getElementById('overlay'),
            themeSelect: document.getElementById('theme-select'),
            rememberMe: document.getElementById('remember-me')
        };
    };

    // Prefill remember me checkbox based on stored preference
    const prefillRememberMe = () => {
        const rememberMe = SessionManager.getRememberMe();
        if (elements.rememberMe) {
            elements.rememberMe.checked = rememberMe;
        }
    };

    // Set up online/offline event listeners
    const setupNetworkListener = () => {
        window.addEventListener('online', handleNetworkChange);
        window.addEventListener('offline', handleNetworkChange);
    };

    // Handle network status changes
    const handleNetworkChange = () => {
        const isOnline = navigator.onLine;
        if (isOnline) {
            showNotification('Połączenie internetowe przywrócone', 'success');
            // Try to sync any pending operations
            if (currentUser) {
                loadShoppingList();
            }
        } else {
            showNotification('Brak połączenia internetowego', 'error');
        }
    };

    // Bind event listeners with debouncing where appropriate
    const bindEvents = () => {
        // Tab switching
        elements.tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.getAttribute('data-tab');
                switchTab(tabName);
            });
        });

        // Item interactions with event delegation
        elements.shoppingItems.addEventListener('click', handleItemClick);

        // Authentication
        elements.btnRegister.addEventListener('click', register);
        elements.btnLogin.addEventListener('click', login);
        elements.btnLogout.addEventListener('click', logout);

        // Shopping list management with debounced input
        elements.btnAddItem.addEventListener('click', addItem);
        elements.newItemInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addItem();
        });
        
        // Debounced refresh to prevent multiple rapid clicks
        elements.btnRefresh.addEventListener('click', Utils.debounce(refreshList, 300));
        
        // Password strength indicator with debounced updates
        elements.registerPassword.addEventListener('input', 
            Utils.debounce(updatePasswordStrength, 300));
        
        // Settings panel
        elements.btnSettings.addEventListener('click', openSettings);
        elements.settingsClose.addEventListener('click', closeSettings);
        elements.overlay.addEventListener('click', closeSettings);
        
        // Theme selection
        elements.themeSelect.addEventListener('change', changeTheme);
        
        // List management buttons
        elements.btnClearList.addEventListener('click', clearList);
        elements.btnRemoveChecked.addEventListener('click', removeCheckedItems);
        elements.btnEditList.addEventListener('click', startListEditing);
        
        // Edit mode buttons
        elements.btnSaveChanges.addEventListener('click', saveListChanges);
        elements.btnCancelEdit.addEventListener('click', cancelListEditing);
    };

    // ===== SESSION MANAGEMENT =====
    
    /**
     * Check if there's a saved valid session
     */
    const checkSavedSession = () => {
        const savedUser = SessionManager.getUser();
        const isSessionValid = SessionManager.isSessionValid();
        const rememberMe = SessionManager.getRememberMe();
        
        // Pre-fill remember me checkbox
        if (elements.rememberMe) {
            elements.rememberMe.checked = rememberMe;
        }
        
        if (savedUser && isSessionValid) {
            // Auto-login with saved user data
            currentUser = savedUser;
            updateUIAfterLogin();
            showNotification('Automatyczne logowanie powiodło się', 'success');
            
            // Load shopping list after automatic login
            loadShoppingList();
        } else if (savedUser && !isSessionValid) {
            // Session expired
            SessionManager.clearSession();
            showNotification('Sesja wygasła. Zaloguj się ponownie.', 'info');
        }
        
        // Pre-fill username if available
        if (savedUser) {
            elements.loginUsername.value = savedUser.username || '';
            elements.registerUsername.value = savedUser.username || '';
        }
    };
    
    /**
     * Save user session if "remember me" is checked
     */
    const saveUserSession = (userData) => {
        const rememberMe = elements.rememberMe && elements.rememberMe.checked;
        SessionManager.saveSession(userData, rememberMe);
    };

    // ===== NETWORK STATUS HANDLING =====
    
    /**
     * Check network status and show appropriate message
     */
    const checkNetworkStatus = () => {
        const isOnline = DatabaseModule.checkNetworkStatus();
        if (!isOnline) {
            showNotification('Brak połączenia internetowego', 'error');
        }
        return isOnline;
    };

    // ===== EVENT HANDLERS =====
    
    /**
     * Handle item click event with event delegation
     * Only handles checkbox clicks in normal mode
     */
    const handleItemClick = (e) => {
        // Only handle checkbox clicks in normal mode
        if (isEditingMode) return;
        
        const listItem = e.target.closest('li');
        if (!listItem || listItem.classList.contains('empty-list')) return;
        
        // Check if checkbox was clicked
        if (e.target.classList.contains('item-checkbox')) {
            const id = parseInt(listItem.dataset.id);
            toggleItem(id);
        }
    };

    // ===== UI MANAGEMENT =====
    
    /**
     * Update UI after successful login
     */
    const updateUIAfterLogin = () => {
        elements.currentUserSpan.textContent = currentUser.username;
        elements.authSection.style.display = 'none';
        elements.appSection.style.display = 'block';
        elements.btnSettings.style.display = 'block';
        
        // Clear form fields
        elements.loginUsername.value = '';
        elements.loginPassword.value = '';
        
        // Load shopping list
        loadShoppingList();
    };
    
    /**
     * Update UI after logout
     */
    const updateUIAfterLogout = () => {
        currentUser = null;
        closeSettings();
        
        elements.currentUserSpan.textContent = 'Nie zalogowano';
        elements.authSection.style.display = 'block';
        elements.appSection.style.display = 'none';
        elements.btnSettings.style.display = 'none';
        
        // Clear shopping list
        shoppingList = [];
        renderShoppingList();
    };

    // ===== SETTINGS FUNCTIONS =====
    
    /**
     * Open settings panel
     */
    const openSettings = () => {
        elements.settingsPanel.classList.add('open');
        elements.overlay.style.display = 'block';
        document.body.style.overflow = 'hidden';
    };
    
    /**
     * Close settings panel
     */
    const closeSettings = () => {
        elements.settingsPanel.classList.remove('open');
        elements.overlay.style.display = 'none';
        document.body.style.overflow = 'auto';
    };
    
    /**
     * Change theme based on user selection
     */
    const changeTheme = () => {
        const theme = elements.themeSelect.value;
        
        // Remove all theme classes
        document.body.classList.remove('modern-theme', 'darkmodern-theme');
        
        // Add selected theme class
        if (theme === 'modern') {
            document.body.classList.add('modern-theme');
        } else if (theme === 'darkmodern') {
            document.body.classList.add('darkmodern-theme');
        }
        
        // Save theme preference
        localStorage.setItem('theme', theme);
        showNotification('Motyw zmieniony', 'success');
    };
    
    /**
     * Load user's theme preference from localStorage
     */
    const loadThemePreference = () => {
        const savedTheme = localStorage.getItem('theme') || 'notes';
        elements.themeSelect.value = savedTheme;
        
        // Apply saved theme
        if (savedTheme === 'modern') {
            document.body.classList.add('modern-theme');
        } else if (savedTheme === 'darkmodern') {
            document.body.classList.add('darkmodern-theme');
        }
    };

    // ===== LIST MANAGEMENT =====
    
    /**
     * Clear entire shopping list with confirmation
     */
    const clearList = async () => {
        confirmAction(
            'Czy na pewno chcesz wyczyścić całą listę? Tej operacji nie można cofnąć.',
            'Wyczyść listę',
            async () => {
                try {
                    await DatabaseModule.clearList();
                    shoppingList = [];
                    renderShoppingList();
                    showNotification('Lista wyczyszczona', 'success');
                    closeSettings();
                } catch (error) {
                    console.error('Error clearing list:', error);
                    showNotification('Błąd podczas czyszczenia listy: ' + error.message, 'error');
                }
            }
        );
    };

    /**
     * Remove all checked items from the list with confirmation
     */
    const removeCheckedItems = async () => {
        const checkedItems = shoppingList.filter(item => item.completed);
        
        if (checkedItems.length === 0) {
            showNotification('Brak zaznaczonych produktów do usunięcia', 'info');
            return;
        }
        
        confirmAction(
            `Czy na pewno chcesz usunąć ${checkedItems.length} zaznaczonych produktów?`,
            'Usuń zaznaczone',
            async () => {
                try {
                    await DatabaseModule.removeCheckedItems();
                    shoppingList = shoppingList.filter(item => !item.completed);
                    renderShoppingList();
                    showNotification(`Usunięto ${checkedItems.length} produktów`, 'success');
                    closeSettings();
                } catch (error) {
                    console.error('Error removing checked items:', error);
                    showNotification('Błąd podczas usuwania zaznaczonych produktów: ' + error.message, 'error');
                }
            }
        );
    };

    // ===== LIST EDITING FUNCTIONS =====
    
    /**
     * Start editing the entire list
     */
    const startListEditing = () => {
        isEditingMode = true;
        originalList = JSON.parse(JSON.stringify(shoppingList)); // Deep copy for cancel
        
        // Show edit mode buttons, hide normal buttons
        elements.btnSaveChanges.style.display = 'block';
        elements.btnCancelEdit.style.display = 'block';
        elements.btnRefresh.style.display = 'none';
        elements.btnAddItem.disabled = true;
        elements.newItemInput.disabled = true;
        elements.newQuantityInput.disabled = true;
        elements.newUnitSelect.disabled = true;
        elements.newDescriptionInput.disabled = true;
        
        // Re-render list in edit mode
        renderShoppingList();
        closeSettings();
        showNotification('Tryb edycji włączony. Edytuj elementy i zapisz zmiany.', 'info');
    };
    
    /**
     * Save changes made during list editing
     */
    const saveListChanges = async () => {
        try {
            // Update all items on server
            await DatabaseModule.replaceShoppingList(shoppingList);
            
            // Exit edit mode
            isEditingMode = false;
            
            // Show normal buttons, hide edit buttons
            elements.btnSaveChanges.style.display = 'none';
            elements.btnCancelEdit.style.display = 'none';
            elements.btnRefresh.style.display = 'block';
            elements.btnAddItem.disabled = false;
            elements.newItemInput.disabled = false;
            elements.newQuantityInput.disabled = false;
            elements.newUnitSelect.disabled = false;
            elements.newDescriptionInput.disabled = false;
            
            // Re-render list in normal mode
            renderShoppingList();
            showNotification('Zmiany zapisane pomyślnie', 'success');
        } catch (error) {
            console.error('Error saving list changes:', error);
            showNotification('Błąd podczas zapisywania zmian: ' + error.message, 'error');
        }
    };
    
    /**
     * Cancel list editing and revert changes
     */
    const cancelListEditing = () => {
        isEditingMode = false;
        shoppingList = JSON.parse(JSON.stringify(originalList)); // Restore original list
        
        // Show normal buttons, hide edit buttons
        elements.btnSaveChanges.style.display = 'none';
        elements.btnCancelEdit.style.display = 'none';
        elements.btnRefresh.style.display = 'block';
        elements.btnAddItem.disabled = false;
        elements.newItemInput.disabled = false;
        elements.newQuantityInput.disabled = false;
        elements.newUnitSelect.disabled = false;
        elements.newDescriptionInput.disabled = false;
        
        // Re-render list in normal mode
        renderShoppingList();
        showNotification('Edycja anulowana. Zmiany nie zostały zapisane.', 'info');
    };
    
    /**
     * Remove item from the list during editing
     */
    const removeItemDuringEditing = (index) => {
        if (confirm('Czy na pewno chcesz usunąć ten produkt z listy?')) {
            shoppingList.splice(index, 1);
            renderShoppingList();
            showNotification('Produkt usunięty', 'info');
        }
    };
    
    /**
     * Update item during editing
     */
    const updateItemDuringEditing = (index, field, value) => {
        if (field === 'quantity' && (isNaN(value) || value < 1)) {
            showNotification('Ilość musi być liczbą większą od 0', 'error');
            return;
        }
        
        if (field === 'text' && !value.trim()) {
            showNotification('Nazwa produktu nie może być pusta', 'error');
            return;
        }
        
        shoppingList[index][field] = value;
    };

    // ===== AUTHENTICATION FUNCTIONS =====
    
    /**
     * Switch between login/register tabs
     */
    const switchTab = (tabName) => {
        elements.tabs.forEach(t => t.classList.remove('active'));
        document.querySelector(`.tab[data-tab="${tabName}"]`).classList.add('active');
        
        if (tabName === 'login') {
            elements.loginTab.classList.add('active');
            elements.registerTab.classList.remove('active');
        } else {
            elements.registerTab.classList.add('active');
            elements.loginTab.classList.remove('active');
        }
    };

    /**
     * Update password strength indicator with detailed feedback
     */
    const updatePasswordStrength = () => {
        const password = elements.registerPassword.value;
        const { strength, feedback, requirements } = PasswordStrength.checkStrength(password);
        
        // Update strength bar
        let width = 0;
        let strengthClass = '';
        
        if (password.length > 0) {
            switch(strength) {
                case 'very-weak': width = 25; strengthClass = 'strength-very-weak'; break;
                case 'weak': width = 50; strengthClass = 'strength-weak'; break;
                case 'medium': width = 75; strengthClass = 'strength-medium'; break;
                case 'strong': width = 100; strengthClass = 'strength-strong'; break;
            }
        }
        
        elements.passwordStrengthBar.style.width = `${width}%`;
        elements.passwordStrengthBar.className = `password-strength-bar ${strengthClass}`;
        elements.passwordFeedback.textContent = feedback;
    };

    /**
     * Show notification message with different types
     */
    const showNotification = (message, type = 'info', duration = 3000) => {
        // Clear any existing notifications
        clearNotification();
        
        elements.notification.textContent = message;
        elements.notification.className = `notification ${type}`;
        elements.notification.style.display = 'block';
        
        // Auto-hide after duration
        elements.notification.timeoutId = setTimeout(() => {
            elements.notification.style.display = 'none';
        }, duration);
    };
    
    /**
     * Clear any visible notification
     */
    const clearNotification = () => {
        if (elements.notification.timeoutId) {
            clearTimeout(elements.notification.timeoutId);
        }
        elements.notification.style.display = 'none';
    };

    /**
     * Show confirmation dialog for destructive actions
     */
    const confirmAction = (message, title, confirmCallback) => {
        // Use native browser confirmation for simplicity
        if (window.confirm(message)) {
            confirmCallback();
        }
    };

    /**
     * Set button loading state
     */
    const setLoading = (button, isLoading) => {
        const buttons = {
            login: {
                loading: elements.loginLoading,
                text: elements.loginText,
                button: elements.btnLogin,
                defaultText: 'Zaloguj się'
            },
            register: {
                loading: elements.registerLoading,
                text: elements.registerText,
                button: elements.btnRegister,
                defaultText: 'Zarejestruj się'
            }
        };
        
        const btnConfig = buttons[button];
        if (!btnConfig) return;
        
        if (isLoading) {
            btnConfig.loading.style.display = 'inline-block';
            btnConfig.text.textContent = 'Przetwarzanie...';
            btnConfig.button.disabled = true;
        } else {
            btnConfig.loading.style.display = 'none';
            btnConfig.text.textContent = btnConfig.defaultText;
            btnConfig.button.disabled = false;
        }
    };

    /**
     * Check if user is locked out due to too many failed login attempts
     */
    const isLockedOut = () => {
        if (failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
            const now = Date.now();
            if (now < lockoutUntil) {
                const remainingMinutes = Math.ceil((lockoutUntil - now) / 60000);
                showNotification(`Zbyt wiele nieudanych prób. Spróbuj ponownie za ${remainingMinutes} minut.`, 'error', 5000);
                return true;
            } else {
                // Reset lockout after time passes
                failedLoginAttempts = 0;
            }
        }
        return false;
    };

    /**
     * Register a new user
     */
    const register = async () => {
        const username = elements.registerUsername.value.trim();
        const password = elements.registerPassword.value;
        const confirm = elements.registerConfirm.value;
        
        // Validate form
        if (!username || !password) {
            showNotification('Login i hasło są wymagane', 'error');
            return;
        }
        
        if (username.length < 3) {
            showNotification('Login musi mieć co najmniej 3 znaki', 'error');
            return;
        }
        
        if (password !== confirm) {
            showNotification('Hasła nie są identyczne', 'error');
            return;
        }
        
        // Check password strength
        const { strength } = PasswordStrength.checkStrength(password);
        if (strength === 'very-weak' || strength === 'weak') {
            showNotification('Hasło jest zbyt słabe', 'error');
            return;
        }
        
        setLoading('register', true);
        
        try {
            await DatabaseModule.registerUser(username, password);
            
            showNotification('Konto zostało utworzone. Możesz się zalogować.', 'success');
            
            // Switch to login tab and clear fields
            switchTab('login');
            elements.registerUsername.value = '';
            elements.registerPassword.value = '';
            elements.registerConfirm.value = '';
            elements.passwordStrengthBar.style.width = '0';
            elements.passwordFeedback.textContent = '';
        } catch (error) {
            console.error('Registration error:', error);
            showNotification('Rejestracja nie powiodła się: ' + error.message, 'error');
        } finally {
            setLoading('register', false);
        }
    };

    /**
     * Login user
     */
    const login = async () => {
        if (isLockedOut()) return;
        
        const username = elements.loginUsername.value.trim();
        const password = elements.loginPassword.value;
        
        // Validate form
        if (!username || !password) {
            showNotification('Login i hasło są wymagane', 'error');
            return;
        }
        
        setLoading('login', true);
        
        try {
            const response = await DatabaseModule.loginUser(username, password);
            
            // Login successful
            failedLoginAttempts = 0;
            currentUser = { username: response.username };
            
            // Save session if "remember me" is checked
            saveUserSession(currentUser);
            
            // Update UI
            updateUIAfterLogin();
            showNotification('Zalogowano pomyślnie', 'success');
        } catch (error) {
            console.error('Login error:', error);
            failedLoginAttempts++;
            
            if (failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
                lockoutUntil = Date.now() + LOCKOUT_TIME;
                showNotification(`Zbyt wiele nieudanych prób. Spróbuj ponownie za 5 minut.`, 'error', 5000);
            } else {
                showNotification(`Logowanie nie powiodło się: ${error.message}. Pozostałe próby: ${MAX_LOGIN_ATTEMPTS - failedLoginAttempts}`, 'error');
            }
        } finally {
            setLoading('login', false);
        }
    };

    /**
     * Logout user
     */
    const logout = async () => {
        try {
            await DatabaseModule.logoutUser();
        } catch (error) {
            console.error('Logout error:', error);
            // Even if server logout fails, clear local session
        } finally {
            // Clear session data
            SessionManager.clearSession();
            updateUIAfterLogout();
            showNotification('Wylogowano pomyślnie', 'info');
        }
    };

    // ===== SHOPPING LIST FUNCTIONS =====
    
    /**
     * Load shopping list from server
     */
    const loadShoppingList = async () => {
        if (!currentUser) return;
        
        try {
            const items = await DatabaseModule.getShoppingList();
            shoppingList = items;
            renderShoppingList();
        } catch (error) {
            console.error('Error loading shopping list:', error);
            showNotification('Błąd podczas ładowania listy: ' + error.message, 'error');
            shoppingList = [];
            renderShoppingList();
        }
    };

    /**
     * Refresh shopping list
     */
    const refreshList = () => {
        loadShoppingList();
        showNotification('Lista odświeżona', 'info');
    };

    /**
     * Add new item to the shopping list
     */
    const addItem = async () => {
        const itemText = elements.newItemInput.value.trim();
        const itemQuantity = elements.newQuantityInput.value;
        const itemUnit = elements.newUnitSelect.value;
        const itemDescription = elements.newDescriptionInput.value.trim();
        
        // Validate form
        if (!itemText) {
            showNotification('Nazwa produktu jest wymagana', 'error');
            return;
        }
        
        if (!itemQuantity || itemQuantity <= 0) {
            showNotification('Ilość musi być większa niż 0', 'error');
            return;
        }
        
        try {
            const newItem = {
                text: itemText,
                quantity: itemQuantity,
                unit: itemUnit,
                description: itemDescription,
                completed: false
            };
            
            const result = await DatabaseModule.addItem(newItem);
            
            // Add new item to local list
            shoppingList.push({
                id: result.id,
                text: itemText,
                quantity: itemQuantity,
                unit: itemUnit,
                description: itemDescription,
                completed: false,
                addedAt: new Date().toISOString()
            });
            
            // Clear fields and refresh list
            elements.newItemInput.value = '';
            elements.newQuantityInput.value = '1';
            elements.newUnitSelect.value = 'szt';
            elements.newDescriptionInput.value = '';
            renderShoppingList();
            showNotification('Produkt dodany', 'success');
        } catch (error) {
            console.error('Error adding item:', error);
            showNotification('Błąd podczas dodawania produktu: ' + error.message, 'error');
        }
    };

    /**
     * Toggle item completion status
     */
    const toggleItem = async (id) => {
        const item = shoppingList.find(item => item.id === id);
        if (item) {
            const completed = !item.completed;
            
            try {
                await DatabaseModule.updateItem(id, { completed });
                
                item.completed = completed;
                if (item.completed) {
                    item.completedAt = new Date().toISOString();
                } else {
                    delete item.completedAt;
                }
                renderShoppingList();
            } catch (error) {
                console.error('Error toggling item:', error);
                showNotification('Błąd podczas aktualizacji produktu: ' + error.message, 'error');
                // Revert UI change
                item.completed = !completed;
                renderShoppingList();
            }
        }
    };

    /**
     * Render shopping list with optimized DOM manipulation
     * Different rendering for normal mode vs edit mode
     */
    const renderShoppingList = () => {
        // Use document fragment for better performance
        const fragment = document.createDocumentFragment();
        
        // Clear current list
        elements.shoppingItems.innerHTML = '';
        
        // Show message if list is empty
        if (shoppingList.length === 0) {
            const emptyItem = document.createElement('li');
            emptyItem.className = 'empty-list';
            emptyItem.innerHTML = `
                <i>📝</i>
                <div>Twoja lista zakupów jest pusta</div>
                <div>Dodaj pierwszy produkt powyżej</div>
            `;
            fragment.appendChild(emptyItem);
        } else {
            // Create list elements for each product
            shoppingList.forEach((item, index) => {
                const li = document.createElement('li');
                li.setAttribute('data-id', item.id);
                
                if (isEditingMode) {
                    // EDIT MODE RENDERING (bez zmian)
                    li.innerHTML = `
                        <div class="edit-item-form">
                            <input type="text" class="edit-item-name" value="${Utils.escapeHtml(item.text)}" 
                                placeholder="Nazwa produktu" onchange="window.ShoppingListApp.updateItemDuringEditing(${index}, 'text', this.value)">
                            
                            <input type="number" class="edit-item-quantity" value="${item.quantity}" min="1" 
                                onchange="window.ShoppingListApp.updateItemDuringEditing(${index}, 'quantity', this.value)">
                            
                            <select class="edit-item-unit" onchange="window.ShoppingListApp.updateItemDuringEditing(${index}, 'unit', this.value)">
                                <option value="szt" ${item.unit === 'szt' ? 'selected' : ''}>szt</option>
                                <option value="kg" ${item.unit === 'kg' ? 'selected' : ''}>kg</option>
                                <option value="g" ${item.unit === 'g' ? 'selected' : ''}>g</option>
                                <option value="l" ${item.unit === 'l' ? 'selected' : ''}>l</option>
                                <option value="ml" ${item.unit === 'ml' ? 'selected' : ''}>ml</option>
                                <option value="opak" ${item.unit === 'opak' ? 'selected' : ''}>opak</option>
                                <option value="inna" ${item.unit === 'inna' ? 'selected' : ''}>inna</option>
                            </select>
                            
                            <textarea class="edit-item-description" placeholder="Opcjonalny opis..." 
                                onchange="window.ShoppingListApp.updateItemDuringEditing(${index}, 'description', this.value)">${Utils.escapeHtml(item.description || '')}</textarea>
                            
                            <button class="btn-danger remove-item-btn" onclick="window.ShoppingListApp.removeItemDuringEditing(${index})">Usuń</button>
                        </div>
                    `;
                } else {
                    // NORMAL MODE RENDERING - ZMIENIONA STRUKTURA
                    const itemMain = document.createElement('div');
                    itemMain.className = 'item-main';
                    
                    // Completion status checkbox
                    const itemCheckbox = document.createElement('input');
                    itemCheckbox.type = 'checkbox';
                    itemCheckbox.className = 'item-checkbox';
                    itemCheckbox.checked = item.completed || false;
                    
                    // Product name with toggle completion capability
                    const itemName = document.createElement('span');
                    itemName.textContent = item.text;
                    itemName.className = `item-name ${item.completed ? 'item-completed' : ''}`;
                    
                    // Quantity and unit container
                    const itemQuantityContainer = document.createElement('div');
                    itemQuantityContainer.className = 'item-quantity-container';
                    itemQuantityContainer.textContent = `${item.quantity} ${item.unit}`;
                    
                    // Create container for text elements
                    const textContainer = document.createElement('div');
                    textContainer.className = 'item-text-container';
                    
                    // Add name to text container
                    textContainer.appendChild(itemName);
                    
                    // Description (if exists) - TERAZ PO NAZWIE, PRZED ILOŚCIĄ
                    if (item.description) {
                        const itemDescription = document.createElement('div');
                        itemDescription.textContent = item.description;
                        itemDescription.className = 'item-description';
                        textContainer.appendChild(itemDescription);
                    }
                    
                    // Create main container for item details
                    const itemDetails = document.createElement('div');
                    itemDetails.className = 'item-details';
                    itemDetails.appendChild(itemCheckbox);
                    itemDetails.appendChild(textContainer);
                    
                    itemMain.appendChild(itemDetails);
                    itemMain.appendChild(itemQuantityContainer);
                    
                    li.appendChild(itemMain);
                }
                
                fragment.appendChild(li);
            });
        }
        
        // Append all elements at once
        elements.shoppingItems.appendChild(fragment);
    };

    // Public methods
    return {
        init,
        startListEditing,
        saveListChanges,
        cancelListEditing,
        removeItemDuringEditing,
        updateItemDuringEditing
    };
})();

// ===== GLOBAL EXPORTS =====
window.ShoppingListApp = ShoppingListApp;
window.removeItemDuringEditing = ShoppingListApp.removeItemDuringEditing;
window.updateItemDuringEditing = ShoppingListApp.updateItemDuringEditing;

// ===== INITIALIZE APPLICATION =====
document.addEventListener('DOMContentLoaded', function() {
    ShoppingListApp.init();
});