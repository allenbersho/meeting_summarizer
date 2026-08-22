/**
 * MeetingSummarizer AI — Workspace Frontend
 * Handles file upload, async summarization, panel navigation, and rendering.
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- DOM References ---
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
    const progressBanner = document.getElementById('progressBanner');
    const progressBar = document.getElementById('progressBar');
    const progressStepText = document.getElementById('progressStepText');
    const progressTimer = document.getElementById('progressTimer');
    const statusEyebrow = document.getElementById('statusEyebrow');

    const uploadView = document.getElementById('uploadView');
    const documentView = document.getElementById('documentView');
    const newMeetingBtn = document.getElementById('newMeetingBtn');

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

    const actionEmptyState = document.getElementById('actionEmptyState');
    const actionLoadedContent = document.getElementById('actionLoadedContent');
    const actionItemsList = document.getElementById('actionItemsList');
    const actionItemsBadge = document.getElementById('actionItemsBadge');
    const actionPanelFooter = document.getElementById('actionPanelFooter');
    const actionProgressText = document.getElementById('actionProgressText');
    const actionProgressFill = document.getElementById('actionProgressFill');
    const priorityChips = document.getElementById('priorityChips');
    const railActionsCount = document.getElementById('railActionsCount');

    const historyList = document.getElementById('historyList');
    const historyEmptyState = document.getElementById('historyEmptyState');
    const historySearchInput = document.getElementById('historySearchInput');
    const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');

    const railUploadBtn = document.getElementById('railUploadBtn');
    const railHistoryBtn = document.getElementById('railHistoryBtn');
    const railActionsBtn = document.getElementById('railActionsBtn');
    const historyPanel = document.getElementById('historyPanel');
    const actionPanel = document.getElementById('actionPanel');
    const panelScrim = document.getElementById('panelScrim');

    const toastContainer = document.getElementById('toastContainer');

    // --- State ---
    let selectedFile = null;
    let currentSummaryData = null;
    let historyCache = [];
    let timerInterval = null;
    let secondsElapsed = 0;
    let activePriorityFilter = 'all';

    const MAX_SIZE_MB = 35;
    const ALLOWED_EXTENSIONS = ['mp3', 'wav', 'm4a', 'webm', 'ogg', 'flac'];
    const isMobile = () => window.matchMedia('(max-width: 1180px)').matches;

    // ==========================================================================
    // File selection & drag/drop
    // ==========================================================================
    selectFileBtn.addEventListener('click', () => audioFileInput.click());

    audioFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) handleFileSelection(e.target.files[0]);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault(); e.stopPropagation();
            dropzone.classList.add('dragover');
        });
    });
    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault(); e.stopPropagation();
            dropzone.classList.remove('dragover');
        });
    });
    dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        if (dt.files && dt.files[0]) handleFileSelection(dt.files[0]);
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
            showToast(`File size (${sizeInMB.toFixed(1)} MB) exceeds the ${MAX_SIZE_MB} MB limit.`, 'error');
            return;
        }

        selectedFile = file;
        fileName.textContent = file.name;
        fileSize.textContent = `${sizeInMB.toFixed(2)} MB`;
        audioPreview.src = URL.createObjectURL(file);

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

    // ==========================================================================
    // Panel navigation (rail buttons)
    // ==========================================================================
    function setRailActive(btn) {
        [railUploadBtn, railHistoryBtn, railActionsBtn].forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
    }

    function openPanel(panel) {
        panel.classList.add('open');
        panelScrim.classList.add('open');
    }
    function closeAllPanels() {
        historyPanel.classList.remove('open');
        actionPanel.classList.remove('open');
        panelScrim.classList.remove('open');
    }
    panelScrim.addEventListener('click', closeAllPanels);

    railUploadBtn.addEventListener('click', () => {
        setRailActive(railUploadBtn);
        closeAllPanels();
        showView(currentSummaryData ? documentView : uploadView);
    });

    railHistoryBtn.addEventListener('click', () => {
        if (isMobile()) { openPanel(historyPanel); }
        else { setRailActive(railHistoryBtn); }
    });

    railActionsBtn.addEventListener('click', () => {
        if (isMobile()) { openPanel(actionPanel); }
        else { setRailActive(railActionsBtn); }
    });

    function showView(view) {
        [uploadView, documentView].forEach(v => v.classList.remove('active'));
        view.classList.add('active');
    }

    newMeetingBtn.addEventListener('click', () => {
        currentSummaryData = null;
        resetFileSelection();
        showView(uploadView);
        setRailActive(railUploadBtn);
        document.querySelectorAll('.history-card').forEach(c => c.classList.remove('selected'));
    });

    // ==========================================================================
    // Processing flow
    // ==========================================================================
    processBtn.addEventListener('click', async () => {
        if (!selectedFile) return;

        setProcessingState(true);
        startTimer();

        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            updateProgress(20, 'Uploading audio file to server...');

            const response = await fetch('/api/summarize', { method: 'POST', body: formData });

            updateProgress(60, 'Transcribing audio with Whisper ASR...');

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: 'Server error' }));
                throw new Error(errorData.detail || `HTTP error ${response.status}`);
            }

            updateProgress(85, 'Extracting insights and action items...');

            const data = await response.json();
            currentSummaryData = data;

            updateProgress(100, 'Complete!');

            renderResults(data);
            prependHistoryItem(data);
            showView(documentView);
            setRailActive(null);
            showToast('Meeting processed and summarized successfully!', 'success');

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
            progressBanner.classList.remove('hidden');
            statusEyebrow.textContent = 'Processing audio…';
        } else {
            progressBanner.classList.add('hidden');
            statusEyebrow.textContent = 'System ready';
        }
    }

    function updateProgress(percent, text) {
        progressBar.style.width = `${percent}%`;
        progressStepText.firstChild.textContent = text + ' ';
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
    function stopTimer() { if (timerInterval) clearInterval(timerInterval); }

    // ==========================================================================
    // Render results
    // ==========================================================================
    function renderResults(data) {
        resMetaId.textContent = `ID: ${data.id || 'N/A'}`;
        resMetaFilename.textContent = data.filename || 'Meeting Recording';
        resMetaDate.textContent = data.created_at ? `Processed: ${new Date(data.created_at).toLocaleDateString()}` : '';

        // Transcript
        const rawTranscript = data.transcript || '';
        transcriptBox.textContent = rawTranscript;
        const words = rawTranscript.trim().split(/\s+/).filter(Boolean).length;
        transcriptWordCount.textContent = `${words} words`;

        // Executive summary
        const summary = data.summary || {};
        overviewText.textContent = summary.overview || 'No overview generated.';

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

        // Action items
        renderActionItems(data.action_items || []);
    }

    let currentActionItems = [];

    function renderActionItems(items) {
        currentActionItems = items;
        actionItemsBadge.textContent = items.length;
        railActionsCount.textContent = items.length;
        railActionsCount.classList.toggle('hidden', items.length === 0);

        if (items.length === 0) {
            actionEmptyState.classList.remove('hidden');
            actionLoadedContent.classList.add('hidden');
            actionPanelFooter.classList.add('hidden');
            return;
        }

        actionEmptyState.classList.add('hidden');
        actionLoadedContent.classList.remove('hidden');
        actionPanelFooter.classList.remove('hidden');

        activePriorityFilter = 'all';
        priorityChips.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.priority === 'all'));

        drawActionItems();
    }

    function drawActionItems() {
        actionItemsList.innerHTML = '';
        const filtered = activePriorityFilter === 'all'
            ? currentActionItems
            : currentActionItems.filter(item => (item.priority || 'medium').toLowerCase().includes(activePriorityFilter));

        if (filtered.length === 0) {
            actionItemsList.innerHTML = '<div class="action-item-card"><div class="task-content"><p class="task-text">No tasks at this priority.</p></div></div>';
        } else {
            filtered.forEach((item, index) => {
                const card = document.createElement('div');
                const priorityKey = getPriorityKey(item.priority);
                card.className = 'action-item-card';
                card.dataset.priority = priorityKey;

                card.innerHTML = `
                    <input type="checkbox" class="checkbox-custom" id="chk_${index}">
                    <div class="task-content">
                        <p class="task-text">${escapeHtml(item.task)}</p>
                        <div class="task-meta">
                            <span class="assignee-badge">${escapeHtml(item.assignee || 'Unassigned')}</span>
                            <span class="priority-badge priority-${priorityKey}">${escapeHtml((item.priority || 'Medium').toUpperCase())}</span>
                        </div>
                    </div>
                `;

                const checkbox = card.querySelector('.checkbox-custom');
                checkbox.addEventListener('change', () => {
                    card.classList.toggle('completed', checkbox.checked);
                    updateActionProgress();
                });

                actionItemsList.appendChild(card);
            });
        }
        updateActionProgress();
    }

    function updateActionProgress() {
        const total = actionItemsList.querySelectorAll('.checkbox-custom').length;
        const done = actionItemsList.querySelectorAll('.checkbox-custom:checked').length;
        actionProgressText.textContent = `${done} of ${total}`;
        actionProgressFill.style.width = total ? `${(done / total) * 100}%` : '0%';
    }

    priorityChips.addEventListener('click', (e) => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        activePriorityFilter = chip.dataset.priority;
        priorityChips.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        drawActionItems();
    });

    function getPriorityKey(priority) {
        if (!priority) return 'medium';
        const p = priority.toLowerCase();
        if (p.includes('high')) return 'high';
        if (p.includes('low')) return 'low';
        return 'medium';
    }

    // ==========================================================================
    // Transcript search & copy
    // ==========================================================================
    transcriptSearch.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        if (!currentSummaryData || !currentSummaryData.transcript) return;
        const text = currentSummaryData.transcript;

        if (!query) { transcriptBox.textContent = text; return; }

        const regex = new RegExp(`(${escapeRegExp(query)})`, 'gi');
        transcriptBox.innerHTML = escapeHtml(text).replace(regex, '<mark>$1</mark>');
    });

    copyTranscriptBtn.addEventListener('click', () => {
        if (!currentSummaryData || !currentSummaryData.transcript) return;
        navigator.clipboard.writeText(currentSummaryData.transcript)
            .then(() => showToast('Transcript copied to clipboard!', 'success'))
            .catch(() => showToast('Failed to copy transcript.', 'error'));
    });

    // ==========================================================================
    // Export JSON
    // ==========================================================================
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

    // ==========================================================================
    // Meeting history (persistent panel, not a drawer)
    // ==========================================================================
    async function loadHistory() {
        historyList.innerHTML = '<div class="panel-empty">Loading meetings…</div>';
        try {
            const res = await fetch('/api/history');
            if (!res.ok) throw new Error('Failed to fetch history');
            const data = await res.json();
            historyCache = data.history || [];
            drawHistory(historyCache);
        } catch (err) {
            historyList.innerHTML = '<div class="panel-empty">Couldn\'t load meeting history.</div>';
        }
    }

    function drawHistory(items) {
        historyList.innerHTML = '';
        if (!items || items.length === 0) {
            historyList.innerHTML = '<div class="panel-empty">No processed meetings yet. Upload a recording to get started.</div>';
            return;
        }
        items.forEach(item => {
            const card = document.createElement('div');
            card.className = 'history-card';
            card.dataset.id = item.id;
            if (currentSummaryData && currentSummaryData.id === item.id) card.classList.add('selected');
            card.innerHTML = `
                <div class="history-title">${escapeHtml(item.filename)}</div>
                <div class="history-date">${item.created_at ? new Date(item.created_at).toLocaleString() : 'Past session'}</div>
                <div class="history-snippet">${escapeHtml(item.overview || 'Click to view summary')}</div>
            `;
            card.addEventListener('click', () => loadSummaryById(item.id));
            historyList.appendChild(card);
        });
    }

    function prependHistoryItem(data) {
        historyCache = [{ id: data.id, filename: data.filename, created_at: data.created_at, overview: data.summary && data.summary.overview }, ...historyCache];
        drawHistory(historyCache);
    }

    historySearchInput.addEventListener('input', (e) => {
        const q = e.target.value.trim().toLowerCase();
        if (!q) { drawHistory(historyCache); return; }
        drawHistory(historyCache.filter(item => (item.filename || '').toLowerCase().includes(q)));
    });

    refreshHistoryBtn.addEventListener('click', loadHistory);

    async function loadSummaryById(id) {
        try {
            const res = await fetch(`/api/summary/${id}`);
            if (!res.ok) throw new Error('Failed to load summary');
            const data = await res.json();
            currentSummaryData = data;
            renderResults(data);
            showView(documentView);
            setRailActive(null);
            document.querySelectorAll('.history-card').forEach(c => c.classList.toggle('selected', c.dataset.id === id));
            if (isMobile()) closeAllPanels();
            showToast(`Loaded summary '${id}'`, 'success');
        } catch (err) {
            showToast(err.message, 'error');
        }
    }

    // ==========================================================================
    // Toasts
    // ==========================================================================
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

    // ==========================================================================
    // Utility helpers
    // ==========================================================================
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>"']/g, (m) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
        })[m]);
    }
    function escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    // --- Init ---
    loadHistory();
});