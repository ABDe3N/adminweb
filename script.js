/**
 * M3aref Admin Question Manager
 * 
 * Features:
 * - Load and display questions from JSON
 * - Search and filter questions
 * - Add, edit, delete questions
 * - Export modified data
 * - Real-time statistics
 * - Pagination
 * - Validation
 */

class QuestionManager {
    constructor() {
        this.questions = [];
        this.filteredQuestions = [];
        this.categories = new Set();
        // Removed pagination - single page listing
        this.editingQuestionId = null;
        this.showSimilarQuestions = false;
        this.selectedQuestionForSimilarity = null;
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.showLoadingSpinner();
        
        // Try to load from localStorage first, then prompt for file
        const savedData = localStorage.getItem('m3aref_questions');
        if (savedData) {
            try {
                const data = JSON.parse(savedData);
                this.loadQuestions(data);
                this.hideLoadingSpinner();
            } catch (e) {
                this.hideLoadingSpinner();
                this.promptForFile();
            }
        } else {
            this.hideLoadingSpinner();
            this.promptForFile();
        }
    }
    
    // Text similarity functions for finding similar questions
    levenshteinDistance(str1, str2) {
        const len1 = str1.length;
        const len2 = str2.length;
        
        // Create a matrix of distances
        const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(null));
        
        // Initialize first row and column
        for (let i = 0; i <= len1; i++) matrix[i][0] = i;
        for (let j = 0; j <= len2; j++) matrix[0][j] = j;
        
        // Fill the matrix
        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,      // deletion
                    matrix[i][j - 1] + 1,      // insertion
                    matrix[i - 1][j - 1] + cost // substitution
                );
            }
        }
        
        return matrix[len1][len2];
    }
    
    calculateSimilarity(text1, text2) {
        if (!text1 || !text2) return 0;
        
        // Normalize text: convert to lowercase, remove extra whitespace, and trim
        const normalizedText1 = text1.toLowerCase().trim().replace(/\s+/g, ' ');
        const normalizedText2 = text2.toLowerCase().trim().replace(/\s+/g, ' ');
        
        if (normalizedText1 === normalizedText2) return 100;
        
        const maxLength = Math.max(normalizedText1.length, normalizedText2.length);
        if (maxLength === 0) return 100;
        
        const distance = this.levenshteinDistance(normalizedText1, normalizedText2);
        const similarity = ((maxLength - distance) / maxLength) * 100;
        
        return Math.round(similarity * 100) / 100; // Round to 2 decimal places
    }
    
    findSimilarQuestionsForQuestion(targetQuestion, threshold = 70) {
        if (!targetQuestion || !targetQuestion.question_text) return [];
        
        return this.questions.filter(question => {
            if (question.id === targetQuestion.id) return false;
            
            const similarity = this.calculateSimilarity(
                targetQuestion.question_text, 
                question.question_text
            );
            
            return similarity >= threshold;
        }).map(question => ({
            ...question,
            similarity: this.calculateSimilarity(targetQuestion.question_text, question.question_text)
        })).sort((a, b) => b.similarity - a.similarity);
    }
    
    bindEvents() {
        // Import/Export buttons
        document.getElementById('importBtn').addEventListener('click', () => {
            document.getElementById('fileInput').click();
        });
        
        document.getElementById('appendBtn').addEventListener('click', () => {
            document.getElementById('appendFileInput').click();
        });
        
        
        document.getElementById('saveBtn').addEventListener('click', () => {
            this.saveToCurrentFile();
        });
        
        document.getElementById('fileInput').addEventListener('change', (e) => {
            this.handleFileImport(e);
        });
        
        document.getElementById('appendFileInput').addEventListener('change', (e) => {
            this.handleFileAppend(e);
        });
        
        // Search and filters
        document.getElementById('searchInput').addEventListener('input', (e) => {
            this.handleSearch(e.target.value);
        });
        
        document.getElementById('categoryFilter').addEventListener('change', (e) => {
            this.handleCategoryFilter(e.target.value);
        });
        
        document.getElementById('difficultyFilter').addEventListener('change', (e) => {
            this.handleDifficultyFilter(e.target.value);
        });
        
        // Add question button
        document.getElementById('addQuestionBtn').addEventListener('click', () => {
            this.addNewQuestion();
        });
        
        // Modal events removed - using inline editing
    }
    
    promptForFile() {
        this.showToast('مرحباً! يرجى استيراد ملف JSON الخاص بالأسئلة للبدء.', 'info');
        
        // Show empty state
        document.getElementById('questionsContainer').innerHTML = `
            <div class="empty-state">
                <div class="icon">📁</div>
                <h3>لا توجد بيانات</h3>
                <p>يرجى استيراد ملف JSON الخاص بالأسئلة للبدء في إدارة الأسئلة.<br>
                اضغط على زر "استيراد ملف JSON" أعلاه.</p>
            </div>
        `;
    }
    
    handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        if (!file.name.endsWith('.json')) {
            this.showToast('يرجى اختيار ملف JSON صالح', 'error');
            return;
        }
        
        this.showLoadingSpinner();
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                this.loadQuestions(data);
                
                // Save to localStorage
                localStorage.setItem('m3aref_questions', JSON.stringify(data));
                
                this.showToast('تم استيراد الأسئلة بنجاح!', 'success');
                this.hideLoadingSpinner();
            } catch (error) {
                console.error('Error parsing JSON:', error);
                this.showToast('خطأ في قراءة ملف JSON: ' + error.message, 'error');
                this.hideLoadingSpinner();
            }
        };
        
        reader.onerror = () => {
            this.showToast('خطأ في قراءة الملف', 'error');
            this.hideLoadingSpinner();
        };
        
        reader.readAsText(file);
        
        // Reset file input
        event.target.value = '';
    }
    
    handleFileAppend(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        if (!file.name.endsWith('.json')) {
            this.showToast('يرجى اختيار ملف JSON صالح', 'error');
            return;
        }
        
        if (this.questions.length === 0) {
            this.showToast('لا توجد بيانات حالية للإلحاق بها. استخدم "استيراد ملف JSON" بدلاً من ذلك.', 'warning');
            return;
        }
        
        this.showLoadingSpinner();
        
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const newData = JSON.parse(e.target.result);
                this.appendQuestions(newData);
                
                // Save to localStorage
                const combinedData = {
                    export_info: {
                        exported_at: new Date().toISOString(),
                        total_questions: this.questions.length,
                        source: 'Admin Web Interface - Appended',
                        note: 'تم الإلحاق باستخدام واجهة الإدارة'
                    },
                    questions: this.questions,
                    categories: [...this.categories].sort()
                };
                localStorage.setItem('m3aref_questions', JSON.stringify(combinedData));
                
                this.showToast('تم إلحاق الأسئلة بنجاح!', 'success');
                this.hideLoadingSpinner();
            } catch (error) {
                console.error('Error parsing JSON:', error);
                this.showToast('خطأ في قراءة ملف JSON: ' + error.message, 'error');
                this.hideLoadingSpinner();
            }
        };
        
        reader.onerror = () => {
            this.showToast('خطأ في قراءة الملف', 'error');
            this.hideLoadingSpinner();
        };
        
        reader.readAsText(file);
        
        // Reset file input
        event.target.value = '';
    }
    
    loadQuestions(data) {
        try {
            
            // Validate data structure
            if (!data || typeof data !== 'object') {
                throw new Error('البيانات المستوردة غير صالحة');
            }
            
            if (!data.questions || !Array.isArray(data.questions)) {
                throw new Error('بنية البيانات غير صحيحة: لا توجد مصفوفة أسئلة');
            }
            
            if (data.questions.length === 0) {
                throw new Error('الملف لا يحتوي على أي أسئلة');
            }
            
            // Validate each question structure
            for (let i = 0; i < data.questions.length; i++) {
                const question = data.questions[i];
                if (!question.question_text || !question.options || !Array.isArray(question.options)) {
                    console.warn(`تحذير: السؤال رقم ${i + 1} يحتوي على بيانات ناقصة`);
                }
            }
            
            this.questions = data.questions.map((q, index) => ({
                ...q,
                id: q.id || this.generateFirestoreId(),
                question_text: q.question_text || '',
                options: Array.isArray(q.options) ? q.options : ['', '', '', ''],
                category: q.category || 'عامة',
                difficulty: parseInt(q.difficulty) || 1,
                // Always editable, no editing states needed
                _hasChanges: false
            }));
            
            this.filteredQuestions = [...this.questions];
            this.extractCategories();
            this.updateStats();
            this.updateCategoryFilter();
            this.updateDifficultyFilter();
            this.renderQuestions();
            // Removed pagination
            
            console.log(`✅ Loaded ${this.questions.length} questions`);
        } catch (error) {
            console.error('❌ Error in loadQuestions:', error);
            throw error;
        }
    }
    
    appendQuestions(newData) {
        try {
            // Validate data structure
            if (!newData || typeof newData !== 'object') {
                throw new Error('البيانات المستوردة غير صالحة');
            }
            
            if (!newData.questions || !Array.isArray(newData.questions)) {
                throw new Error('بنية البيانات غير صحيحة: لا توجد مصفوفة أسئلة');
            }
            
            if (newData.questions.length === 0) {
                throw new Error('الملف لا يحتوي على أي أسئلة جديدة');
            }
            
            // Get existing question IDs and texts for duplicate detection
            const existingIds = new Set(this.questions.map(q => q.id));
            const existingTexts = new Set(this.questions.map(q => q.question_text?.trim().toLowerCase()));
            
            let appendedCount = 0;
            let skippedCount = 0;
            let duplicateCount = 0;
            
            // Process each new question
            for (let i = 0; i < newData.questions.length; i++) {
                const newQuestion = newData.questions[i];
                
                // Validate question structure
                if (!newQuestion.question_text || !newQuestion.options || !Array.isArray(newQuestion.options)) {
                    console.warn(`تحذير: السؤال رقم ${i + 1} يحتوي على بيانات ناقصة - تم تخطيه`);
                    skippedCount++;
                    continue;
                }
                
                // Check for duplicate by ID
                let questionId = newQuestion.id || this.generateFirestoreId();
                if (existingIds.has(questionId)) {
                    // Generate new unique ID
                    questionId = this.generateFirestoreId();
                }
                
                // Check for duplicate by question text
                const normalizedText = newQuestion.question_text.trim().toLowerCase();
                if (existingTexts.has(normalizedText)) {
                    console.warn(`تحذير: السؤال "${newQuestion.question_text.substring(0, 50)}..." موجود مسبقاً - تم تخطيه`);
                    duplicateCount++;
                    continue;
                }
                
                // Create processed question
                const processedQuestion = {
                    ...newQuestion,
                    id: questionId,
                    question_text: newQuestion.question_text || '',
                    options: Array.isArray(newQuestion.options) ? newQuestion.options : ['', '', '', ''],
                    category: newQuestion.category || 'عامة',
                    difficulty: parseInt(newQuestion.difficulty) || 1,
                    // Always editable, no editing states needed
                    _hasChanges: false
                };
                
                // Add to questions array
                this.questions.push(processedQuestion);
                existingIds.add(questionId);
                existingTexts.add(normalizedText);
                appendedCount++;
            }
            
            // Update filtered questions and UI
            this.filteredQuestions = [...this.questions];
            this.extractCategories();
            this.updateStats();
            this.updateCategoryFilter();
            this.updateDifficultyFilter();
            this.renderQuestions();
            // Removed pagination
            
            // Show detailed results
            let resultMessage = `تم إلحاق ${appendedCount} سؤال جديد بنجاح!`;
            if (skippedCount > 0) {
                resultMessage += `\nتم تخطي ${skippedCount} سؤال بسبب بيانات ناقصة.`;
            }
            if (duplicateCount > 0) {
                resultMessage += `\nتم تخطي ${duplicateCount} سؤال مكرر.`;
            }
            
            console.log(`✅ Appended ${appendedCount} questions, skipped ${skippedCount} invalid, ${duplicateCount} duplicates`);
            console.log(`📊 Total questions now: ${this.questions.length}`);
            
            this.showToast(resultMessage, appendedCount > 0 ? 'success' : 'warning');
            
        } catch (error) {
            console.error('❌ Error in appendQuestions:', error);
            throw error;
        }
    }
    
    extractCategories() {
        this.categories.clear();
        this.questions.forEach(q => {
            if (q.category) {
                this.categories.add(q.category);
            }
        });
    }
    
    updateStats() {
        // Basic stats (exclude deleted questions)
        const activeQuestions = this.questions.filter(q => !q._isDeleted);
        const totalQuestions = activeQuestions.length;
        const totalCategories = this.categories.size;
        
        // Update main stats
        document.getElementById('totalQuestions').textContent = totalQuestions;
        document.getElementById('totalCategories').textContent = totalCategories;
        
        // Update filtered count (exclude deleted from filtered count too)
        const activeFilteredQuestions = this.filteredQuestions.filter(q => !q._isDeleted);
        document.getElementById('filteredCount').textContent = activeFilteredQuestions.length;
    }
    
    // Generate Firestore-style document ID (20 characters, lexicographically distributed)
    generateFirestoreId() {
        // Firestore uses a combination of timestamp and random characters for distribution
        // This mimics the scatter algorithm used by Firestore
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        
        // Use current timestamp (in base62) for some ordering
        let timestamp = Date.now().toString(36);
        
        // Add random characters to reach 20 characters and ensure distribution
        let randomPart = '';
        const totalLength = 20;
        const remainingLength = totalLength - timestamp.length;
        
        for (let i = 0; i < remainingLength; i++) {
            randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        // Scatter the timestamp within the random part to avoid sequential patterns
        let result = '';
        let timestampIndex = 0;
        let randomIndex = 0;
        
        for (let i = 0; i < totalLength; i++) {
            // Randomly decide whether to use timestamp or random character
            if (timestampIndex < timestamp.length && Math.random() > 0.7) {
                result += timestamp[timestampIndex++];
            } else if (randomIndex < randomPart.length) {
                result += randomPart[randomIndex++];
            } else if (timestampIndex < timestamp.length) {
                result += timestamp[timestampIndex++];
            }
        }
        
        return result;
    }
    
    updateCategoryFilter() {
        const categoryFilter = document.getElementById('categoryFilter');
        const currentValue = categoryFilter.value;
        
        // Calculate category counts
        const categoryStats = {};
        this.questions.forEach(q => {
            const category = q.category || 'غير محدد';
            categoryStats[category] = (categoryStats[category] || 0) + 1;
        });
        
        categoryFilter.innerHTML = '<option value="">جميع الفئات</option>';
        
        [...this.categories].sort().forEach(category => {
            const count = categoryStats[category] || 0;
            const option = document.createElement('option');
            option.value = category;
            option.textContent = `${category} (${count})`;
            categoryFilter.appendChild(option);
        });
        
        // Restore previous selection
        if (currentValue) {
            categoryFilter.value = currentValue;
        }
        
        // Modal category dropdown removed
    }
    
    // updateModalCategoryDropdown removed - using inline editing
    
    updateDifficultyFilter() {
        const difficultyFilter = document.getElementById('difficultyFilter');
        const currentValue = difficultyFilter.value;
        
        // Calculate difficulty counts
        const difficultyStats = {};
        for (let i = 1; i <= 5; i++) {
            difficultyStats[i] = this.questions.filter(q => q.difficulty === i).length;
        }
        
        difficultyFilter.innerHTML = '<option value="">جميع المستويات</option>';
        
        // Add difficulty levels with counts
        for (let i = 1; i <= 5; i++) {
            const count = difficultyStats[i];
            const option = document.createElement('option');
            option.value = i.toString();
            option.textContent = `المستوى ${i} (${count})`;
            difficultyFilter.appendChild(option);
        }
        
        // Restore previous selection
        if (currentValue) {
            difficultyFilter.value = currentValue;
        }
    }
    
    handleSearch(query) {
        this.applyFilters();
    }
    
    handleCategoryFilter(category) {
        this.applyFilters();
    }
    
    handleDifficultyFilter(difficulty) {
        this.applyFilters();
    }
    
    findSimilarQuestions(questionId) {
        const question = this.questions.find(q => q.id === questionId);
        if (!question) return;
        
        // Toggle similar questions mode
        if (this.showSimilarQuestions && this.selectedQuestionForSimilarity && this.selectedQuestionForSimilarity.id === questionId) {
            // If clicking the same question, turn off similar mode
            this.showSimilarQuestions = false;
            this.selectedQuestionForSimilarity = null;
            this.showToast('تم إلغاء عرض الأسئلة المشابهة', 'info');
        } else {
            // Enable similar questions mode for this question
            this.showSimilarQuestions = true;
            this.selectedQuestionForSimilarity = question;
            
            // Show feedback
            const similarQuestions = this.findSimilarQuestionsForQuestion(question, 70);
            this.showToast(`تم العثور على ${similarQuestions.length} أسئلة مشابهة للسؤال #${questionId}`, 'success');
        }
        
        this.applyFilters();
    }
    
    clearSimilaritySelection() {
        this.selectedQuestionForSimilarity = null;
        this.applyFilters();
        this.showToast('تم إلغاء تصفية الأسئلة المشابهة', 'info');
    }
    
    applyFilters() {
        const searchQuery = document.getElementById('searchInput').value.toLowerCase().trim();
        const categoryFilter = document.getElementById('categoryFilter').value;
        const difficultyFilter = document.getElementById('difficultyFilter').value;
        
        let filteredQuestions = this.questions.filter(question => {
            // Search filter
            const matchesSearch = !searchQuery || 
                question.question_text.toLowerCase().includes(searchQuery) ||
                question.id.toLowerCase().includes(searchQuery) ||
                (question.options && question.options.some(opt => 
                    opt.toLowerCase().includes(searchQuery)
                ));
            
            // Category filter
            const matchesCategory = !categoryFilter || question.category === categoryFilter;
            
            // Difficulty filter
            const matchesDifficulty = !difficultyFilter || 
                question.difficulty === parseInt(difficultyFilter);
            
            return matchesSearch && matchesCategory && matchesDifficulty;
        });
        
        // Apply similar questions filter if enabled
        if (this.showSimilarQuestions && this.selectedQuestionForSimilarity) {
            const similarQuestions = this.findSimilarQuestionsForQuestion(this.selectedQuestionForSimilarity, 70);
            
            // Filter to show only similar questions plus the selected question
            filteredQuestions = filteredQuestions.filter(question => 
                question.id === this.selectedQuestionForSimilarity.id ||
                similarQuestions.some(similar => similar.id === question.id)
            );
            
            // Add similarity data to questions for display
            filteredQuestions = filteredQuestions.map(question => {
                if (question.id === this.selectedQuestionForSimilarity.id) {
                    return { ...question, similarity: 100, isReference: true };
                }
                const similarQuestion = similarQuestions.find(sq => sq.id === question.id);
                return similarQuestion ? { ...question, similarity: similarQuestion.similarity } : question;
            });
            
            // Sort by similarity (highest first)
            filteredQuestions.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
        }
        
        this.filteredQuestions = filteredQuestions;
        this.renderQuestions();
        // Removed pagination
        this.updatePaginationInfo();
        
        // Update filtered count in stats
        document.getElementById('filteredCount').textContent = this.filteredQuestions.length;
    }
    
    renderQuestions() {
        const container = document.getElementById('questionsContainer');
        // Show all filtered questions on one page
        const pageQuestions = this.filteredQuestions;
        
        let content = '';
        
        // Show similar questions notice if in similar questions mode
        if (this.showSimilarQuestions && this.selectedQuestionForSimilarity) {
            const similarCount = pageQuestions.filter(q => !q.isReference).length;
            content += `
                <div class="similar-questions-notice">
                    <span class="icon">🔗</span>
                    عرض الأسئلة المشابهة للسؤال: #${this.selectedQuestionForSimilarity.id}
                    (${similarCount} أسئلة مشابهة بنسبة 70% أو أكثر)
                    <button class="btn btn-small btn-secondary" onclick="window.questionManager.clearSimilaritySelection()" style="margin-right: 10px;">
                        إلغاء التصفية
                    </button>
                </div>
            `;
        }
        
        if (pageQuestions.length === 0) {
            content += `
                <div class="empty-state">
                    <div class="icon">🔍</div>
                    <h3>لا توجد نتائج</h3>
                    <p>لم يتم العثور على أسئلة تطابق معايير البحث المحددة.</p>
                </div>
            `;
        } else {
            content += pageQuestions.map(question => this.renderQuestionCard(question)).join('');
        }
        
        container.innerHTML = content;
        
        // Bind input change events for real-time editing
        container.querySelectorAll('.question-edit-textarea').forEach(textarea => {
            textarea.addEventListener('input', (e) => {
                const questionId = e.target.closest('.question-card').dataset.questionId;
                this.updateQuestionField(questionId, 'question_text', e.target.value);
            });
        });
        
        container.querySelectorAll('.option-edit-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const questionId = e.target.closest('.question-card').dataset.questionId;
                const optionIndex = parseInt(e.target.dataset.optionIndex);
                this.updateQuestionOption(questionId, optionIndex, e.target.value);
            });
        });
        
        container.querySelectorAll('.difficulty-edit-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const questionId = e.target.closest('.question-card').dataset.questionId;
                this.updateQuestionField(questionId, 'difficulty', parseInt(e.target.value));
            });
        });
        
        container.querySelectorAll('.category-edit-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const questionId = e.target.closest('.question-card').dataset.questionId;
                this.updateQuestionField(questionId, 'category', e.target.value);
            });
        });
        
        container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                // Prevent rapid clicking
                if (btn.disabled) return;
                btn.disabled = true;
                setTimeout(() => btn.disabled = false, 500);
                
                const questionId = e.target.closest('.question-card').dataset.questionId;
                this.deleteQuestion(questionId);
            });
        });
    }
    
    renderQuestionCard(question) {
        const options = question.options || [];
        const hasSimilarity = question.similarity !== undefined && question.similarity !== null;
        const isReference = question.isReference === true;
        
        // Generate category options for dropdown
        const categoryOptions = [...this.categories].sort().map(cat => 
            `<option value="${this.escapeHtml(cat)}" ${cat === question.category ? 'selected' : ''}>${this.escapeHtml(cat)}</option>`
        ).join('');
        
        const optionsHtml = options.map((option, index) => `
            <div class="option-item ${index === 0 ? 'correct' : ''}" data-option-index="${index}">
                <input type="text" class="option-edit-input" value="${this.escapeHtml(option)}" data-option-index="${index}" ${question._isDeleted ? 'disabled readonly' : ''}>
                ${index === 0 ? '<span class="correct-indicator">✓</span>' : ''}
            </div>
        `).join('');
        
        // Determine card classes
        let cardClasses = ['question-card', 'always-editing'];
        if (question._hasChanges) cardClasses.push('modified');
        if (question._isDeleted) cardClasses.push('deleted');
        if (hasSimilarity && !isReference) cardClasses.push('similar');
        if (isReference) cardClasses.push('reference');
        
        return `
            <div class="${cardClasses.join(' ')}" data-question-id="${question.id}" ${isReference ? 'data-reference="true"' : ''}>
                ${question._isDeleted ? '<div class="delete-overlay"><div class="delete-icon">🗑️</div><div class="delete-text">محذوف</div></div>' : ''}
                <div class="question-header">
                    <div class="question-meta">
                        <span class="question-id">#${question.id}</span>
                        ${hasSimilarity ? 
                            `<span class="similarity-badge">${isReference ? 'مرجعي' : `${question.similarity.toFixed(1)}% تشابه`}</span>` : ''
                        }
                        <select class="difficulty-edit-select" data-field="difficulty" ${question._isDeleted ? 'disabled' : ''}>
                            <option value="1" ${question.difficulty === 1 ? 'selected' : ''}>مستوى 1</option>
                            <option value="2" ${question.difficulty === 2 ? 'selected' : ''}>مستوى 2</option>
                            <option value="3" ${question.difficulty === 3 ? 'selected' : ''}>مستوى 3</option>
                            <option value="4" ${question.difficulty === 4 ? 'selected' : ''}>مستوى 4</option>
                            <option value="5" ${question.difficulty === 5 ? 'selected' : ''}>مستوى 5</option>
                        </select>
                        <select class="category-edit-select" data-field="category" ${question._isDeleted ? 'disabled' : ''}>
                            <option value="">اختر الفئة</option>
                            ${categoryOptions}
                        </select>
                    </div>
                    <div class="question-actions">
                        <button class="btn ${question._isDeleted ? 'btn-success' : 'btn-danger'} btn-small delete-btn">
                            <span class="icon">${question._isDeleted ? '↩️' : '🗑️'}</span>
                            ${question._isDeleted ? 'إلغاء الحذف' : 'حذف'}
                        </button>
                        ${!question._isDeleted ? (
                            !this.showSimilarQuestions ? 
                                `<button class="btn btn-warning btn-small find-similar-btn" onclick="window.questionManager.findSimilarQuestions('${question.id}')">
                                    <span class="icon">🔗</span>
                                    أسئلة مشابهة
                                </button>` : 
                                (this.selectedQuestionForSimilarity && this.selectedQuestionForSimilarity.id === question.id ? 
                                    `<button class="btn btn-info btn-small find-similar-btn active">
                                        <span class="icon">📍</span>
                                        مرجعي
                                    </button>` :
                                    `<button class="btn btn-warning btn-small find-similar-btn" onclick="window.questionManager.findSimilarQuestions('${question.id}')">
                                        <span class="icon">🔗</span>
                                        أسئلة مشابهة
                                    </button>`
                                )
                        ) : ''}
                    </div>
                </div>
                
                <div class="question-content">
                    <textarea class="question-edit-textarea" data-field="question_text" rows="2" ${question._isDeleted ? 'disabled readonly' : ''}>${this.escapeHtml(question.question_text || '')}</textarea>
                </div>
                
                <div class="options-list">
                    ${optionsHtml}
                </div>
            </div>
        `;
    }
    

    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Removed renderPagination() - single page listing
    
    updatePaginationInfo() {
        const total = this.filteredQuestions.length;
        
        document.getElementById('paginationInfo').textContent = 
            `عرض ${total} سؤال`;
    }
    
    // Removed goToPage() - single page listing
    
    // Modal functions removed - using inline editing instead
    
    addNewQuestion() {
        const newQuestion = {
            id: this.generateFirestoreId(),
            question_text: 'سؤال جديد - اضغط تعديل لإضافة المحتوى',
            options: ['الإجابة الصحيحة', 'خيار خاطئ 1', 'خيار خاطئ 2', 'خيار خاطئ 3'],
            category: [...this.categories][0] || 'عامة',
            difficulty: 1,
            _hasChanges: true
        };
        
        // Add to beginning of list for immediate visibility
        this.questions.unshift(newQuestion);
        
        // Update data and UI
        this.saveData();
        this.extractCategories();
        this.updateStats();
        this.updateCategoryFilter();
        this.updateDifficultyFilter();
        this.applyFilters();
        
        // Scroll to top and focus
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        this.showToast('تم إضافة سؤال جديد - يرجى تعديل المحتوى', 'info');
    }
    
    markQuestionAsModified(questionId) {
        const questionIndex = this.questions.findIndex(q => q.id === questionId);
        if (questionIndex === -1) return;
        
        const question = this.questions[questionIndex];
        question._hasChanges = true;
        
        // Update stats and filters in case category changed
        this.extractCategories();
        this.updateStats();
        this.updateCategoryFilter();
        this.updateDifficultyFilter();
        
        // Re-render to show modified state
        this.renderQuestions();
    }
    
    updateQuestionField(questionId, field, value) {
        const questionIndex = this.questions.findIndex(q => q.id === questionId);
        if (questionIndex === -1) return;
        
        const question = this.questions[questionIndex];
        question[field] = value;
        question._hasChanges = true;
        
        // Update stats and filters if needed
        if (field === 'category' || field === 'difficulty') {
            this.extractCategories();
            this.updateStats();
            this.updateCategoryFilter();
            this.updateDifficultyFilter();
        }
        
        // Only re-render if it's a structural change, not for text input
        if (field === 'category' || field === 'difficulty') {
            this.renderQuestions();
        } else {
            // Just update the visual indicator without full re-render
            const questionCard = document.querySelector(`[data-question-id="${questionId}"]`);
            if (questionCard) {
                questionCard.classList.add('modified');
            }
        }
    }
    
    updateQuestionOption(questionId, optionIndex, value) {
        const questionIndex = this.questions.findIndex(q => q.id === questionId);
        if (questionIndex === -1) return;
        
        const question = this.questions[questionIndex];
        if (!question.options) question.options = ['', '', '', ''];
        
        question.options[optionIndex] = value;
        question._hasChanges = true;
        
        // Just update the visual indicator without full re-render
        const questionCard = document.querySelector(`[data-question-id="${questionId}"]`);
        if (questionCard) {
            questionCard.classList.add('modified');
        }
    }
    
    saveToCurrentFile() {
        // Show loading state
        this.showLoadingSpinner();
        
        try {
            // Validate all questions before saving
            const invalidQuestions = [];
            
            for (let i = 0; i < this.questions.length; i++) {
                const question = this.questions[i];
                // Skip deleted questions in validation
                if (question._isDeleted) continue;
                
                const questionCard = document.querySelector(`[data-question-id="${question.id}"]`);
            
            if (questionCard) {
                // Collect current data from the form
                const questionText = questionCard.querySelector('.question-edit-textarea')?.value.trim() || '';
                const category = questionCard.querySelector('.category-edit-select')?.value || '';
                const difficulty = parseInt(questionCard.querySelector('.difficulty-edit-select')?.value) || 1;
                const options = [];
                
                const optionInputs = questionCard.querySelectorAll('.option-edit-input');
                optionInputs.forEach(input => {
                    options.push(input.value.trim());
                });
                
                // Update the question object with current values
                question.question_text = questionText;
                question.category = category;
                question.difficulty = difficulty;
                question.options = options;
                
                // Validate
                if (!questionText || !category || options.length !== 4 || options.some(opt => !opt)) {
                    invalidQuestions.push(i + 1);
                    continue;
                }
                
                // Check for duplicate options
                const uniqueOptions = new Set(options);
                if (uniqueOptions.size !== 4) {
                    invalidQuestions.push(i + 1);
                    continue;
                }
            }
        }
        
            if (invalidQuestions.length > 0) {
                this.hideLoadingSpinner();
                this.showToast(`يرجى إكمال البيانات للأسئلة: ${invalidQuestions.join(', ')}`, 'error');
                return;
            }
            
            // Remove deleted questions permanently and clear change flags
            const deletedCount = this.questions.filter(q => q._isDeleted).length;
            this.questions = this.questions.filter(q => !q._isDeleted);
            
            this.questions.forEach(q => {
                q._hasChanges = false;
            });
            
            // Save to localStorage and update UI
            this.saveData();
            
            if (deletedCount > 0) {
                this.showToast(`تم حذف ${deletedCount} سؤال نهائياً من الملف`, 'info');
            }
            this.extractCategories();
            this.updateStats();
            this.updateCategoryFilter();
            this.updateDifficultyFilter();
            this.renderQuestions();
            
            this.hideLoadingSpinner();
            this.showToast('تم حفظ جميع التعديلات بنجاح!', 'success');
            
        } catch (error) {
            this.hideLoadingSpinner();
            console.error('❌ Error saving data:', error);
            this.showToast('خطأ في حفظ البيانات: ' + error.message, 'error');
        }
    }
    
    // Removed cancelInlineEdit - no longer needed since all fields are always editable
    
    deleteQuestion(questionId) {
        const question = this.questions.find(q => q.id === questionId);
        if (!question) {
            return;
        }
        
        if (question._isDeleted) {
            // Undelete if already deleted
            this.undeleteQuestion(questionId);
            return;
        }
        
        // Soft delete - just mark as deleted
        question._isDeleted = true;
        question._hasChanges = true;
        
        // Update UI immediately
        this.renderQuestions();
        this.updateStats();
        
        this.showToast('تم وضع علامة حذف على السؤال - اضغط حفظ لحذفه نهائياً', 'warning');
    }
    
    undeleteQuestion(questionId) {
        const question = this.questions.find(q => q.id === questionId);
        if (!question) {
            return;
        }
        
        // Remove delete flag
        delete question._isDeleted;
        question._hasChanges = true;
        
        // Update UI immediately
        this.renderQuestions();
        this.updateStats();
        
        this.showToast('تم إلغاء حذف السؤال', 'success');
    }
    
    saveData() {
        // Include all questions (even deleted ones) in localStorage for session persistence
        // But clean the deleted flag when actually saving to file
        const data = {
            export_info: {
                exported_at: new Date().toISOString(),
                total_questions: this.questions.filter(q => !q._isDeleted).length,
                source: 'Admin Web Interface',
                note: 'تم التعديل باستخدام واجهة الإدارة'
            },
            questions: this.questions, // Keep all questions including deleted ones for session
            categories: [...this.categories].sort(),
            difficulty_stats: {
                1: this.questions.filter(q => q.difficulty === 1 && !q._isDeleted).length,
                2: this.questions.filter(q => q.difficulty === 2 && !q._isDeleted).length,
                3: this.questions.filter(q => q.difficulty === 3 && !q._isDeleted).length,
                4: this.questions.filter(q => q.difficulty === 4 && !q._isDeleted).length,
                5: this.questions.filter(q => q.difficulty === 5 && !q._isDeleted).length
            }
        };
        
        localStorage.setItem('m3aref_questions', JSON.stringify(data));
    }
    
    exportData() {
        if (this.questions.length === 0) {
            this.showToast('لا توجد بيانات للتصدير', 'warning');
            return;
        }
        
        // Clean questions data by removing internal UI state fields and filter out deleted questions
        const cleanedQuestions = this.questions
            .filter(question => !question._isDeleted)
            .map(question => {
                const { _isEditing, _hasChanges, _originalData, _isDeleted, ...cleanQuestion } = question;
                return cleanQuestion;
            });
        
        const data = {
            export_info: {
                exported_at: new Date().toISOString(),
                total_questions: cleanedQuestions.length,
                source: 'Admin Web Interface',
                note: 'All questions are approved. Correct answer is always the first option.',
                removed_fields: ['admin', 'submission', 'correct_answer_index', 'status', '_isEditing', '_hasChanges', '_originalData']
            },
            questions: cleanedQuestions,
            categories: [...this.categories].sort(),
            difficulty_stats: {
                1: cleanedQuestions.filter(q => q.difficulty === 1).length,
                2: cleanedQuestions.filter(q => q.difficulty === 2).length,
                3: cleanedQuestions.filter(q => q.difficulty === 3).length,
                4: cleanedQuestions.filter(q => q.difficulty === 4).length,
                5: cleanedQuestions.filter(q => q.difficulty === 5).length
            }
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '_');
        a.href = url;
        a.download = `m3aref_questions_${timestamp}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        this.showToast('تم تصدير البيانات بنجاح!', 'success');
    }
    
    showLoadingSpinner() {
        document.getElementById('loadingSpinner').classList.add('show');
    }
    
    hideLoadingSpinner() {
        document.getElementById('loadingSpinner').classList.remove('show');
    }
    
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        document.getElementById('toastContainer').appendChild(toast);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
        
        console.log(`${type.toUpperCase()}: ${message}`);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.questionManager = new QuestionManager();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + I = Import
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
        e.preventDefault();
        document.getElementById('fileInput').click();
    }
    
    // Ctrl/Cmd + A = Append (only if not selecting all text)
    if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !e.target.matches('input, textarea')) {
        e.preventDefault();
        if (window.questionManager && window.questionManager.questions.length > 0) {
            document.getElementById('appendFileInput').click();
        }
    }
    
    
    // Ctrl/Cmd + N = New Question
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        if (window.questionManager) {
            window.questionManager.addNewQuestion();
        }
    }
    
    // Ctrl/Cmd + S = Save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (window.questionManager) {
            window.questionManager.saveToCurrentFile();
        }
    }
});