/**
 * MeetingSummarizer AI - Vanilla JavaScript Frontend Core
 * Handles File Uploads, Async API Fetching, DOM Rendering, & Toast Alerts
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const dropzone = document.getElementById('dropzone');
    const audioFileInput = document.getElementById('audioFileInput');
    const selectFileBtn = document.getElementById('selectFileBtn');
    const dropzoneContent = document.getElementById('dropzoneContent');
    const selectedFileInfo = document.getElementById('selectedFileInfo');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    const audioPreview = document.getElementById('audioPreview');
    const removeFileBtn = document.getElementById('removeFileBtn');

    const processBtn = document.getElementById('processBtn');
    const processSpinner = document.getElementById('processSpinner');
    const progressBanner = document.getElementById('progressBanner');
    const progressBar = document.getElementById('progressBar');
    const progressStepText = document.getElementById('progressStepText');
    const progressTimer = document.getElementById('progressTimer');

    const resultsSection = document.getElementById('resultsSection');
    const resMetaId = document.getElementById('resMetaId');
    const resMetaFilename = document.getElementById('resMetaFilename');
    const resMetaDate = document.getElementById('resMetaDate');
    const exportJsonBtn = document.getElementById('exportJsonBtn');

    const transcriptBox = document.getElementById('transcriptBox');
    const transcriptSearch = document.getElementById('transcriptSearch');
    const transcriptWordCount = document.getElementById('transcriptWordCount');
    const copyTranscriptBtn = document.getElementById('copyTranscriptBtn');

    const overviewText = document.getElementById('overviewText');
    const keyDecisionsList = document.getElementById('keyDecisionsList');
    const keyTopicsTags = document.getElementById('keyTopicsTags');

    const actionItemsList = document.getElementById('actionItemsList');
    const actionItemsBadge = document.getElementById('actionItemsBadge');

    const toggleHistoryBtn = document.getElementById('toggleHistoryBtn');
    const historyDrawer = document.getElementById('historyDrawer');
    const closeHistoryBtn = document.getElementById('closeHistoryBtn');
    const drawerOverlay = document.getElementById('drawerOverlay');
    const historyList = document.getElementById('historyList');

    const toastContainer = document.getElementById('toastContainer');
    const statusText = document.getElementById('statusText');

    // --- State Variables ---
    let selectedFile = null;
    let currentSummaryData = null;
    let timerInterval = null;
    let secondsElapsed = 0;

    const MAX_SIZE_MB = 35;
    const ALLOWED_EXTENSIONS = ['mp3', 'wav', 'm4a', 'webm', 'ogg', 'flac'];

    // --- Event Listeners: File Upload & Drag-and-Drop ---
    selectFileBtn.addEventListener('click', () => audioFileInput.click());

    audioFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            handleFileSelection(e.target.files[0]);
        }
    });

    // Drag and Drop Events
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add('dragover');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('dragover');
        });
    });

    dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        if (dt.files && dt.files[0]) {
            handleFileSelection(dt.files[0]);
        }
    });

    removeFileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        resetFileSelection();
    });

    function handleFileSelection(file) {
        const ext = file.name.split('.').pop().toLowerCase();
        
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            showToast(`Invalid audio format '.${ext}'. Please choose MP3, WAV, M4A, WEBM, or OGG.`, 'error');
            return;
        }

        const sizeInMB = file.size / (1024 * 1024);
        if (sizeInMB > MAX_SIZE_MB) {
            showToast(`File size (${sizeInMB.toFixed(1)} MB) exceeds maximum limit of ${MAX_SIZE_MB} MB.`, 'error');
            return;
        }

        selectedFile = file;
        fileName.textContent = file.name;
        fileSize.textContent = `${sizeInMB.toFixed(2)} MB`;

        // Create Object URL for native audio player preview
        const objectUrl = URL.createObjectURL(file);
        audioPreview.src = objectUrl;

        dropzoneContent.classList.add('hidden');
        selectedFileInfo.classList.remove('hidden');
        processBtn.disabled = false;
        
        showToast('Audio file loaded successfully.', 'success');
    }

    function resetFileSelection() {
        selectedFile = null;
        audioFileInput.value = '';
        audioPreview.src = '';
        dropzoneContent.classList.remove('hidden');
        selectedFileInfo.classList.add('hidden');
        processBtn.disabled = true;
    }

    // --- Tab Switching Logic ---
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            
            tabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        });
    });

    // --- Async Upload & Summarization Flow ---
    processBtn.addEventListener('click', async () => {
        if (!selectedFile) return;

        // UI Loading State
        setProcessingState(true);
        startTimer();

        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            updateProgress(20, 'Uploading audio file to server...');

            const response = await fetch('/api/summarize', {
                method: 'POST',
                body: formData
            });

            updateProgress(60, 'Transcribing audio with Whisper ASR...');

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: 'Server Error' }));
                throw new Error(errorData.detail || `HTTP Error ${response.status}`);
            }

            updateProgress(85, 'Extracting key insights and action items with LLM...');

            const data = await response.json();
            currentSummaryData = data;

            updateProgress(100, 'Complete!');
            
            // Render Results
            renderResults(data);
            showToast('Meeting processed & summarized successfully!', 'success');

        } catch (err) {
            console.error('Error during summarization:', err);
            showToast(err.message || 'An error occurred during audio processing.', 'error');
        } finally {
            stopTimer();
            setProcessingState(false);
        }
    });

    function setProcessingState(isProcessing) {
        processBtn.disabled = isProcessing;
        if (isProcessing) {
            processSpinner.classList.remove('hidden');
            progressBanner.classList.remove('hidden');
            statusText.textContent = 'Processing Audio...';
        } else {
            processSpinner.classList.add('hidden');
            progressBanner.classList.add('hidden');
            statusText.textContent = 'System Ready';
        }
    }

    function updateProgress(percent, text) {
        progressBar.style.width = `${percent}%`;
        progressStepText.textContent = text;
    }

    function startTimer() {
        secondsElapsed = 0;
        progressTimer.textContent = '00:00';
        timerInterval = setInterval(() => {
            secondsElapsed++;
            const mins = String(Math.floor(secondsElapsed / 60)).padStart(2, '0');
            const secs = String(secondsElapsed % 60).padStart(2, '0');
            progressTimer.textContent = `${mins}:${secs}`;
        }, 1000);
    }

    function stopTimer() {
        if (timerInterval) clearInterval(timerInterval);
    }

    // --- Render Results to DOM ---
    function renderResults(data) {
        resultsSection.classList.remove('hidden');

        // Meta Header
        resMetaId.textContent = `ID: ${data.id || 'N/A'}`;
        resMetaFilename.textContent = data.filename || 'Meeting Recording';
        resMetaDate.textContent = data.created_at ? `Processed: ${new Date(data.created_at).toLocaleDateString()}` : '';

        // 1. Render Transcript
        const rawTranscript = data.transcript || '';
        transcriptBox.textContent = rawTranscript;
        const words = rawTranscript.trim().split(/\s+/).filter(Boolean).length;
        transcriptWordCount.textContent = `${words} words`;

        // 2. Render Executive Summary
        const summary = data.summary || {};
        overviewText.textContent = summary.overview || 'No overview generated.';

        // Key Decisions List
        keyDecisionsList.innerHTML = '';
        const decisions = summary.key_decisions || [];
        if (decisions.length === 0) {
            keyDecisionsList.innerHTML = '<li>No explicit key decisions highlighted.</li>';
        } else {
            decisions.forEach(dec => {
                const li = document.createElement('li');
                li.textContent = dec;
                keyDecisionsList.appendChild(li);
            });
        }

        // Discussion Topics Tags
        keyTopicsTags.innerHTML = '';
        const topics = summary.key_topics || [];
        if (topics.length === 0) {
            keyTopicsTags.innerHTML = '<span class="topic-tag">General Discussion</span>';
        } else {
            topics.forEach(topic => {
                const span = document.createElement('span');
                span.className = 'topic-tag';
                span.textContent = topic;
                keyTopicsTags.appendChild(span);
            });
        }

        // 3. Render Action Items
        renderActionItems(data.action_items || []);

        // Scroll smooth to results
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    function renderActionItems(items) {
        actionItemsList.innerHTML = '';
        actionItemsBadge.textContent = items.length;

        if (items.length === 0) {
            actionItemsList.innerHTML = '<div class="action-item-card"><p>No actionable tasks identified in this meeting.</p></div>';
            return;
        }

        items.forEach((item, index) => {
            const card = document.createElement('div');
            card.className = 'action-item-card';

            const priorityClass = getPriorityClass(item.priority);

            card.innerHTML = `
                <input type="checkbox" class="checkbox-custom" id="chk_${index}">
                <div class="task-content">
                    <p class="task-text">${escapeHtml(item.task)}</p>
                    <div class="task-meta">
                        <span class="assignee-badge">👤 ${escapeHtml(item.assignee || 'Unassigned')}</span>
                        <span class="priority-badge ${priorityClass}">${escapeHtml(item.priority || 'Medium')}</span>
                    </div>
                </div>
            `;

            const checkbox = card.querySelector('.checkbox-custom');
            checkbox.addEventListener('change', () => {
                card.classList.toggle('completed', checkbox.checked);
            });

            actionItemsList.appendChild(card);
        });
    }

    function getPriorityClass(priority) {
        if (!priority) return 'priority-medium';
        const p = priority.toLowerCase();
        if (p.includes('high')) return 'priority-high';
        if (p.includes('low')) return 'priority-low';
        return 'priority-medium';
    }

    // --- Search Transcript ---
    transcriptSearch.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        if (!currentSummaryData || !currentSummaryData.transcript) return;

        const text = currentSummaryData.transcript;
        if (!query) {
            transcriptBox.textContent = text;
            return;
        }

        const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
        const highlighted = text.replace(regex, '<mark>$1</mark>');
        transcriptBox.innerHTML = highlighted;
    });

    // --- Copy Transcript Button ---
    copyTranscriptBtn.addEventListener('click', () => {
        if (!currentSummaryData || !currentSummaryData.transcript) return;
        navigator.clipboard.writeText(currentSummaryData.transcript)
            .then(() => showToast('Transcript copied to clipboard!', 'success'))
            .catch(() => showToast('Failed to copy transcript.', 'error'));
    });

    // --- Export JSON Button ---
    exportJsonBtn.addEventListener('click', () => {
        if (!currentSummaryData) return;
        const jsonStr = JSON.stringify(currentSummaryData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${currentSummaryData.id || 'summary'}.json`;
        a.click();
        URL.revokeObjectURL(url);
    });

    // --- Side Drawer: Meeting History ---
    toggleHistoryBtn.addEventListener('click', openHistoryDrawer);
    closeHistoryBtn.addEventListener('click', closeHistoryDrawer);
    drawerOverlay.addEventListener('click', closeHistoryDrawer);

    async function openHistoryDrawer() {
        historyDrawer.classList.add('open');
        historyList.innerHTML = '<p style="color: var(--text-muted);">Loading past meetings...</p>';

        try {
            const res = await fetch('/api/history');
            if (!res.ok) throw new Error('Failed to fetch history');
            const data = await res.json();
            
            historyList.innerHTML = '';
            if (data.history.length === 0) {
                historyList.innerHTML = '<p style="color: var(--text-muted);">No saved meeting summaries found.</p>';
                return;
            }

            data.history.forEach(item => {
                const card = document.createElement('div');
                card.className = 'history-card';
                card.innerHTML = `
                    <div class="history-title">${escapeHtml(item.filename)}</div>
                    <div class="history-date">${item.created_at ? new Date(item.created_at).toLocaleString() : 'Past Session'}</div>
                    <div class="history-snippet">${escapeHtml(item.overview || 'Click to view summary')}</div>
                `;
                card.addEventListener('click', () => loadSummaryById(item.id));
                historyList.appendChild(card);
            });
        } catch (err) {
            historyList.innerHTML = '<p style="color: var(--danger-color);">Error loading history.</p>';
        }
    }

    function closeHistoryDrawer() {
        historyDrawer.classList.remove('open');
    }

    async function loadSummaryById(id) {
        try {
            closeHistoryDrawer();
            const res = await fetch(`/api/summary/${id}`);
            if (!res.ok) throw new Error('Failed to load summary');
            const data = await res.json();
            currentSummaryData = data;
            renderResults(data);
            showToast(`Loaded summary '${id}'`, 'success');
        } catch (err) {
            showToast(err.message, 'error');
        }
    }

    // --- Toast Alert Utility ---
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // Utility Helpers
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>"']/g, (m) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
        })[m]);
    }

    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
});
