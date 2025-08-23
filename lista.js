// ===== DATABASE MODULE =====
const DatabaseModule = (() => {
    // Base API URL - adjust according to your server configuration
    const API_BASE_URL = 'https://stronakszona.pl/lista';

    /**
     * Make API request to server
     * @param {string} endpoint - API endpoint
     * @param {string} method - HTTP method
     * @param {object} data - Data to send
     * @returns {Promise} - Promise with response
     */
    const apiRequest = async (endpoint, method = 'GET', data = null) => {
        try {
            const options = {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include' // Include cookies for session management
            };

            if (data && (method === 'POST' || method === 'PUT')) {
                options.body = JSON.stringify(data);
            }

            const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    };

    /**
     * Register a new user
     * @param {string} username - User's username
     * @param {string} password - User's password
     * @returns {Promise} - Promise with response
     */
    const registerUser = async (username, password) => {
        return apiRequest('/register.php', 'POST', { username, password });
    };

    /**
     * Login user
     * @param {string} username - User's username
     * @param {string} password - User's password
     * @returns {Promise} - Promise with response
     */
    const loginUser = async (username, password) => {
        return apiRequest('/login.php', 'POST', { username, password });
    };

    /**
     * Logout user
     * @returns {Promise} - Promise with response
     */
    const logoutUser = async () => {
        return apiRequest('/logout.php', 'POST');
    };

    /**
     * Get user's shopping list
     * @returns {Promise} - Promise with shopping list
     */
    const getShoppingList = async () => {
        return apiRequest('/items.php', 'GET');
    };

    /**
     * Add new item to shopping list
     * @param {object} item - Item to add
     * @returns {Promise} - Promise with response
     */
    const addItem = async (item) => {
        return apiRequest('/items.php', 'POST', item);
    };

    /**
     * Update existing item
     * @param {number} id - Item ID
     * @param {object} updates - Fields to update
     * @returns {Promise} - Promise with response
     */
    const updateItem = async (id, updates) => {
        return apiRequest(`/items.php?id=${id}`, 'PUT', updates);
    };

    /**
     * Delete item from shopping list
     * @param {number} id - Item ID
     * @returns {Promise} - Promise with response
     */
    const deleteItem = async (id) => {
        return apiRequest(`/items.php?id=${id}`, 'DELETE');
    };

    /**
     * Remove all checked items
     * @returns {Promise} - Promise with response
     */
    const removeCheckedItems = async () => {
        return apiRequest('/items.php?action=remove_checked', 'DELETE');
    };

    /**
     * Clear entire shopping list
     * @returns {Promise} - Promise with response
     */
    const clearList = async () => {
        return apiRequest('/items.php?action=clear', 'DELETE');
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
        clearList
    };
})();

// ===== PASSWORD STRENGTH MODULE =====
const PasswordStrength = (() => {
    /**
     * Check password strength
     * @param {string} password - Password to check
     * @returns {object} - Object containing strength score and feedback
     */
    const checkStrength = (password) => {
        let strength = 0;
        let feedback = '';
        
        // Length check
        if (password.length >= 8) strength += 1;
        else feedback = 'Hasło powinno mieć co najmniej 8 znaków. ';
        
        // Contains both lowercase and uppercase
        if (password.match(/([a-z].*[A-Z])|([A-Z].*[a-z])/)) strength += 1;
        else feedback += 'Dodaj wielkie i małe litery. ';
        
        // Contains numbers
        if (password.match(/([0-9])/)) strength += 1;
        else feedback += 'Dodaj cyfry. ';
        
        // Contains special characters
        if (password.match(/([!,@,#,$,%,^,&,*,?,_,~])/)) strength += 1;
        else feedback += 'Dodaj znaki specjalne. ';
        
        return { strength, feedback: feedback || 'Mocne hasło!' };
    };
    
    return {
        checkStrength
    };
})();

// ===== APPLICATION MODULE =====
const ShoppingListApp = (() => {
    // DOM Elements
    const elements = {
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
        btnClearList: document.getElementById('btn-clear-list'),
        btnRemoveChecked: document.getElementById('btn-remove-checked'),
        actionModal: document.getElementById('action-modal'),
        modalEdit: document.getElementById('modal-edit'),
        modalDelete: document.getElementById('modal-delete'),
        modalCancel: document.getElementById('modal-cancel')
    };

    // Application state
    let currentUser = null;
    let shoppingList = [];
    let failedLoginAttempts = 0;
    const MAX_LOGIN_ATTEMPTS = 5;
    const LOCKOUT_TIME = 5 * 60 * 1000; // 5 minutes in milliseconds
    let lockoutUntil = 0;
    let selectedItemId = null;

    // Initialize the application
    const init = () => {
        bindEvents();
        checkAuth();
        loadThemePreference();
    };

    // Bind event listeners
    const bindEvents = () => {
        // Tab switching
        elements.tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.getAttribute('data-tab');
                switchTab(tabName);
            });
        });

        // Item interactions
        elements.shoppingItems.addEventListener('click', handleItemClick);
        elements.shoppingItems.addEventListener('dblclick', handleItemDoubleClick);

        // Authentication
        elements.btnRegister.addEventListener('click', register);
        elements.btnLogin.addEventListener('click', login);
        elements.btnLogout.addEventListener('click', logout);

        // Shopping list management
        elements.btnAddItem.addEventListener('click', addItem);
        elements.newItemInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addItem();
        });
        elements.btnRefresh.addEventListener('click', refreshList);
        
        // Password strength indicator
        elements.registerPassword.addEventListener('input', updatePasswordStrength);
        
        // Settings panel
        elements.btnSettings.addEventListener('click', openSettings);
        elements.settingsClose.addEventListener('click', closeSettings);
        elements.overlay.addEventListener('click', closeSettings);
        
        // Theme selection
        elements.themeSelect.addEventListener('change', changeTheme);
        
        // Clear list button
        elements.btnClearList.addEventListener('click', clearList);
        
        // Remove checked items button
        elements.btnRemoveChecked.addEventListener('click', removeCheckedItems);
        
        // Action modal buttons
        elements.modalEdit.addEventListener('click', handleEditItem);
        elements.modalDelete.addEventListener('click', handleDeleteItem);
        elements.modalCancel.addEventListener('click', closeActionModal);
    };

    // ===== EVENT HANDLERS =====
    
    /**
     * Handle item click event
     * @param {Event} e - Click event
     */
    const handleItemClick = (e) => {
        const listItem = e.target.closest('li');
        if (!listItem) return;
        
        const id = parseInt(listItem.dataset.id);
        if (e.target.classList.contains('item-checkbox')) {
            toggleItem(id);
        }
    };
    
    /**
     * Handle item double click event
     * @param {Event} e - Double click event
     */
    const handleItemDoubleClick = (e) => {
        const listItem = e.target.closest('li');
        if (listItem && !e.target.classList.contains('item-checkbox')) {
            const id = parseInt(listItem.dataset.id);
            showActionModal(id);
        }
    };
    
    /**
     * Handle edit item button click
     */
    const handleEditItem = () => {
        if (selectedItemId) {
            closeActionModal();
            editItem(selectedItemId);
        }
    };
    
    /**
     * Handle delete item button click
     */
    const handleDeleteItem = () => {
        if (selectedItemId) {
            closeActionModal();
            if (confirm('Czy na pewno chcesz usunąć ten produkt?')) {
                removeItem(selectedItemId);
            }
        }
    };

    // ===== SETTINGS FUNCTIONS =====
    
    /**
     * Opens the settings panel
     */
    const openSettings = () => {
        elements.settingsPanel.classList.add('open');
        elements.overlay.style.display = 'block';
        document.body.style.overflow = 'hidden';
    };
    
    /**
     * Closes the settings panel
     */
    const closeSettings = () => {
        elements.settingsPanel.classList.remove('open');
        elements.overlay.style.display = 'none';
        document.body.style.overflow = 'auto';
    };
    
    /**
     * Changes the theme based on user selection
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
     * Loads the user's theme preference from localStorage
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
    
    /**
     * Clears the entire shopping list
     */
    const clearList = async () => {
        if (confirm('Czy na pewno chcesz wyczyścić całą listę? Tej operacji nie można cofnąć.')) {
            try {
                await DatabaseModule.clearList();
                shoppingList = [];
                renderShoppingList();
                showNotification('Lista wyczyszczona', 'success');
                closeSettings();
            } catch (error) {
                console.error('Error clearing list:', error);
                showNotification('Błąd podczas czyszczenia listy', 'error');
            }
        }
    };

    /**
     * Removes all checked items from the list
     */
    const removeCheckedItems = async () => {
        const checkedItems = shoppingList.filter(item => item.completed);
        
        if (checkedItems.length === 0) {
            showNotification('Brak zaznaczonych produktów do usunięcia', 'info');
            return;
        }
        
        if (confirm(`Czy na pewno chcesz usunąć ${checkedItems.length} zaznaczonych produktów?`)) {
            try {
                await DatabaseModule.removeCheckedItems();
                shoppingList = shoppingList.filter(item => !item.completed);
                renderShoppingList();
                showNotification(`Usunięto ${checkedItems.length} produktów`, 'success');
                closeSettings();
            } catch (error) {
                console.error('Error removing checked items:', error);
                showNotification('Błąd podczas usuwania zaznaczonych produktów', 'error');
            }
        }
    };

    // ===== ACTION MODAL FUNCTIONS =====
    
    /**
     * Shows the action modal for item operations
     * @param {number} itemId - The ID of the item to perform actions on
     */
    const showActionModal = (itemId) => {
        selectedItemId = itemId;
        elements.actionModal.style.display = 'block';
        elements.overlay.style.display = 'block';
    };
    
    /**
     * Hides the action modal
     */
    const closeActionModal = () => {
        selectedItemId = null;
        elements.actionModal.style.display = 'none';
        elements.overlay.style.display = 'none';
    };

    // ===== AUTHENTICATION FUNCTIONS =====
    
    /**
     * Switch between login/register tabs
     * @param {string} tabName - The name of the tab to switch to
     */
    const switchTab = (tabName) => {
        elements.tabs.forEach(t => t.classList.remove('active'));
        elements.loginTab.classList.remove('active');
        elements.registerTab.classList.remove('active');
        
        document.querySelector(`.tab[data-tab="${tabName}"]`).classList.add('active');
        
        if (tabName === 'login') {
            elements.loginTab.classList.add('active');
        } else {
            elements.registerTab.classList.add('active');
        }
    };

    /**
     * Update password strength indicator
     */
    const updatePasswordStrength = () => {
        const password = elements.registerPassword.value;
        const { strength, feedback } = PasswordStrength.checkStrength(password);
        
        // Update strength bar
        let width = 0;
        let strengthClass = '';
        
        if (password.length > 0) {
            width = (strength / 4) * 100;
            
            if (strength < 2) {
                strengthClass = 'strength-weak';
            } else if (strength < 4) {
                strengthClass = 'strength-medium';
            } else {
                strengthClass = 'strength-strong';
            }
        }
        
        elements.passwordStrengthBar.style.width = `${width}%`;
        elements.passwordStrengthBar.className = `password-strength-bar ${strengthClass}`;
        elements.passwordFeedback.textContent = feedback;
    };

    /**
     * Show notification message
     * @param {string} message - The message to display
     * @param {string} type - The type of notification (success, error, warning, info)
     */
    const showNotification = (message, type = 'info') => {
        elements.notification.textContent = message;
        elements.notification.className = `notification ${type}`;
        elements.notification.style.display = 'block';
        
        setTimeout(() => {
            elements.notification.style.display = 'none';
        }, 3000);
    };

    /**
     * Set button loading state
     * @param {string} button - The button to set loading state for ('login' or 'register')
     * @param {boolean} isLoading - Whether the button is in loading state
     */
    const setLoading = (button, isLoading) => {
        if (button === 'login') {
            if (isLoading) {
                elements.loginLoading.style.display = 'inline-block';
                elements.loginText.textContent = 'Logowanie...';
                elements.btnLogin.disabled = true;
            } else {
                elements.loginLoading.style.display = 'none';
                elements.loginText.textContent = 'Zaloguj się';
                elements.btnLogin.disabled = false;
            }
        } else if (button === 'register') {
            if (isLoading) {
                elements.registerLoading.style.display = 'inline-block';
                elements.registerText.textContent = 'Rejestracja...';
                elements.btnRegister.disabled = true;
            } else {
                elements.registerLoading.style.display = 'none';
                elements.registerText.textContent = 'Zarejestruj się';
                elements.btnRegister.disabled = false;
            }
        }
    };

    /**
     * Check if user is locked out due to too many failed login attempts
     * @returns {boolean} - True if user is locked out, false otherwise
     */
    const isLockedOut = () => {
        if (failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
            const now = Date.now();
            if (now < lockoutUntil) {
                const remainingMinutes = Math.ceil((lockoutUntil - now) / 60000);
                showNotification(`Zbyt wiele nieudanych prób. Spróbuj ponownie za ${remainingMinutes} minut.`, 'error');
                return true;
            } else {
                // Reset lockout after time passes
                failedLoginAttempts = 0;
            }
        }
        return false;
    };

    /**
     * Check authentication status and update UI accordingly
     */
    const checkAuth = () => {
        // Check if user is logged in (session stored in cookie via PHP)
        // This will be handled by the server-side session
        // For now, we'll rely on the server to redirect or maintain session state
        // We'll try to fetch the user's data to verify authentication
        loadShoppingList();
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
        
        if (password !== confirm) {
            showNotification('Hasła nie są identyczne', 'error');
            return;
        }
        
        // Check password strength
        const { strength } = PasswordStrength.checkStrength(password);
        if (strength < 2) {
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
            showNotification('Wystąpił błąd podczas rejestracji', 'error');
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
            
            // Update UI
            elements.currentUserSpan.textContent = currentUser.username;
            elements.authSection.style.display = 'none';
            elements.appSection.style.display = 'block';
            elements.btnSettings.style.display = 'block';
            
            // Clear form fields
            elements.loginUsername.value = '';
            elements.loginPassword.value = '';
            
            // Load shopping list
            loadShoppingList();
            showNotification('Zalogowano pomyślnie', 'success');
        } catch (error) {
            console.error('Login error:', error);
            failedLoginAttempts++;
            
            if (failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
                lockoutUntil = Date.now() + LOCKOUT_TIME;
                showNotification(`Zbyt wiele nieudanych prób. Spróbuj ponownie za 5 minut.`, 'error');
            } else {
                showNotification(`Nieprawidłowy login lub hasło. Pozostałe próby: ${MAX_LOGIN_ATTEMPTS - failedLoginAttempts}`, 'error');
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
        } finally {
            currentUser = null;
            closeSettings();
            
            // Update UI
            elements.currentUserSpan.textContent = 'Nie zalogowano';
            elements.authSection.style.display = 'block';
            elements.appSection.style.display = 'none';
            elements.btnSettings.style.display = 'none';
            
            // Clear shopping list
            shoppingList = [];
            renderShoppingList();
            
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
            showNotification('Błąd podczas dodawania produktu', 'error');
        }
    };

    /**
     * Toggle item completion status
     * @param {number} id - The ID of the item to toggle
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
                showNotification('Błąd podczas aktualizacji produktu', 'error');
            }
        }
    };

    /**
     * Remove item from the list
     * @param {number} id - The ID of the item to remove
     */
    const removeItem = async (id) => {
        try {
            await DatabaseModule.deleteItem(id);
            shoppingList = shoppingList.filter(item => item.id !== id);
            renderShoppingList();
            showNotification('Produkt usunięty', 'success');
        } catch (error) {
            console.error('Error removing item:', error);
            showNotification('Błąd podczas usuwania produktu', 'error');
        }
    };

    /**
     * Start item editing
     * @param {number} id - The ID of the item to edit
     */
    const editItem = (id) => {
        const item = shoppingList.find(item => item.id === id);
        if (!item) return;
        
        // Find DOM element and switch to edit mode
        const listItem = document.querySelector(`li[data-id="${id}"]`);
        if (!listItem) return;
        
        listItem.classList.add('editing');
        
        // Create edit form
        const editForm = document.createElement('form');
        editForm.className = 'edit-form';
        editForm.innerHTML = `
            <input type="text" class="edit-item-name" value="${escapeHtml(item.text)}" placeholder="Nazwa produktu">
            <input type="number" class="edit-item-quantity" value="${item.quantity}" placeholder="Ilość" min="1">
            <select class="edit-item-unit">
                <option value="szt" ${item.unit === 'szt' ? 'selected' : ''}>szt</option>
                <option value="kg" ${item.unit === 'kg' ? 'selected' : ''}>kg</option>
                <option value="g" ${item.unit === 'g' ? 'selected' : ''}>g</option>
                <option value="l" ${item.unit === 'l' ? 'selected' : ''}>l</option>
                <option value="ml" ${item.unit === 'ml' ? 'selected' : ''}>ml</option>
                <option value="opak" ${item.unit === 'opak' ? 'selected' : ''}>opak</option>
                <option value="inna" ${item.unit === 'inna' ? 'selected' : ''}>inna</option>
            </select>
            <textarea class="edit-item-description edit-description-field" placeholder="Opcjonalny opis...">${escapeHtml(item.description || '')}</textarea>
            <div class="edit-form-actions">
                <button type="button" class="btn-secondary cancel-edit">Anuluj</button>
                <button type="submit" class="btn-primary save-edit">Zapisz</button>
            </div>
        `;
        
        // Replace element content with edit form
        listItem.innerHTML = '';
        listItem.appendChild(editForm);
        
        // Handle form submission
        editForm.addEventListener('submit', function(e) {
            e.preventDefault();
            saveEditedItem(id, editForm);
        });
        
        // Handle cancel action
        const cancelBtn = editForm.querySelector('.cancel-edit');
        cancelBtn.addEventListener('click', function() {
            renderShoppingList();
        });
    };

    /**
     * Save edited item
     * @param {number} id - The ID of the item being edited
     * @param {HTMLElement} form - The edit form element
     */
    const saveEditedItem = async (id, form) => {
        const item = shoppingList.find(item => item.id === id);
        if (!item) return;
        
        const nameInput = form.querySelector('.edit-item-name');
        const quantityInput = form.querySelector('.edit-item-quantity');
        const unitSelect = form.querySelector('.edit-item-unit');
        const descriptionInput = form.querySelector('.edit-item-description');
        
        // Validate data
        if (!nameInput.value.trim()) {
            showNotification('Nazwa produktu jest wymagana', 'error');
            return;
        }
        
        if (!quantityInput.value || quantityInput.value <= 0) {
            showNotification('Ilość musi być większa niż 0', 'error');
            return;
        }
        
        try {
            // Update item on server
            await DatabaseModule.updateItem(id, {
                text: nameInput.value.trim(),
                quantity: quantityInput.value,
                unit: unitSelect.value,
                description: descriptionInput.value.trim()
            });
            
            // Update local item
            item.text = nameInput.value.trim();
            item.quantity = quantityInput.value;
            item.unit = unitSelect.value;
            item.description = descriptionInput.value.trim();
            item.updatedAt = new Date().toISOString();
            
            // Re-render list
            renderShoppingList();
            showNotification('Produkt zaktualizowany', 'success');
        } catch (error) {
            console.error('Error updating item:', error);
            showNotification('Błąd podczas aktualizacji produktu', 'error');
        }
    };

    /**
     * Render shopping list
     */
    const renderShoppingList = () => {
        elements.shoppingItems.innerHTML = '';
        
        // Show message if list is empty
        if (shoppingList.length === 0) {
            elements.shoppingItems.innerHTML = `
                <li class="empty-list">
                    <i>📝</i>
                    <div>Twoja lista zakupów jest pusta</div>
                    <div>Dodaj pierwszy produkt powyżej</div>
                </li>
            `;
            return;
        }
        
        // Create list items for each product
        shoppingList.forEach(item => {
            const li = document.createElement('li');
            li.setAttribute('data-id', item.id);
            
            // Main container for item (name on left, quantity on right)
            const itemMain = document.createElement('div');
            itemMain.className = 'item-main';
            
            // Item details container (left side)
            const itemDetails = document.createElement('div');
            itemDetails.className = 'item-details';
            
            // Checkbox for completion status
            const itemCheckbox = document.createElement('input');
            itemCheckbox.type = 'checkbox';
            itemCheckbox.className = 'item-checkbox';
            itemCheckbox.checked = item.completed || false;
            itemCheckbox.addEventListener('change', () => toggleItem(item.id));
            
            // Product name with completion toggle
            const itemName = document.createElement('span');
            itemName.textContent = item.text;
            itemName.className = `item-name ${item.completed ? 'item-completed' : ''}`;
            
            // Quantity and unit container (right side)
            const itemQuantityContainer = document.createElement('div');
            itemQuantityContainer.className = 'item-quantity-container';
            itemQuantityContainer.textContent = `${item.quantity} ${item.unit}`;
            
            // Description (if exists)
            let itemDescription = null;
            if (item.description) {
                itemDescription = document.createElement('span');
                itemDescription.textContent = item.description;
                itemDescription.className = 'item-description';
            }
            
            // Add elements to DOM
            itemDetails.appendChild(itemCheckbox);
            itemDetails.appendChild(itemName);
            if (itemDescription) {
                itemDetails.appendChild(itemDescription);
            }
            
            itemMain.appendChild(itemDetails);
            itemMain.appendChild(itemQuantityContainer);
            
            li.appendChild(itemMain);
            
            // Add double click event for editing
            li.addEventListener('dblclick', () => showActionModal(item.id));
            
            elements.shoppingItems.appendChild(li);
        });
    };

    /**
     * Escape HTML special characters
     * @param {string} text - The text to escape
     * @returns {string} - The escaped text
     */
    const escapeHtml = (text) => {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, function(m) { return map[m]; });
    };

    // Public methods
    return {
        init
    };
})();

// ===== INITIALIZE APPLICATION =====
document.addEventListener('DOMContentLoaded', function() {
    ShoppingListApp.init();
});