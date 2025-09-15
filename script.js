// Authentication handling
document.addEventListener('DOMContentLoaded', function() {
    // Valid users for demo (in real app, this would be server-side)
    const validUsers = [
        { badgeId: "MP1234", password: "securepass123", rank: "Inspector", name: "Rajesh Kumar", station: "Shivajinagar PS" },
        { badgeId: "MP5678", password: "police2023", rank: "Sub-Inspector", name: "Priya Singh", station: "Bandra PS" }
    ];

    // Check if we're on the login page
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();

            const overlay = document.getElementById('loadingOverlay');
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            // show overlay and disable submit so user sees "Please wait" state
            if (overlay) {
                overlay.classList.remove('hidden');
                overlay.setAttribute('aria-hidden', 'false');
            }
            if (submitBtn) submitBtn.disabled = true;

            const badgeId = document.getElementById('badgeId').value;
            const password = document.getElementById('password').value;
            
            // small delay to ensure loading UI is visible (remove/adjust for real async)
            setTimeout(() => {
                // Enhanced authentication
                const user = validUsers.find(u => u.badgeId === badgeId && u.password === password);
                
                if (user) {
                    // Store authentication status in localStorage
                    localStorage.setItem('isAuthenticated', 'true');
                    localStorage.setItem('badgeId', badgeId);
                    localStorage.setItem('userData', JSON.stringify({
                        name: user.name,
                        rank: user.rank,
                        station: user.station
                    }));
                    // keep overlay visible briefly then redirect
                    setTimeout(() => {
                        window.location.href = 'dashboard.html';
                    }, 300);
                } else {
                    // hide overlay and re-enable submit on failure
                    if (overlay) {
                        overlay.classList.add('hidden');
                        overlay.setAttribute('aria-hidden', 'true');
                    }
                    if (submitBtn) submitBtn.disabled = false;
                    document.getElementById('errorMsg').textContent = 'Invalid Badge ID or Password';
                }
            }, 450);
        });
    }
    
    // Check if we're on the dashboard
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        // Check authentication
        const isAuthenticated = localStorage.getItem('isAuthenticated');
        if (!isAuthenticated || isAuthenticated !== 'true') {
            window.location.href = 'index.html';
            return;
        }
        
        // Display user info
        const userData = JSON.parse(localStorage.getItem('userData') || '{}');
        const userInfoElement = document.getElementById('userInfo');
        if (userInfoElement && userData.name) {
            userInfoElement.textContent = `${userData.rank} ${userData.name} | ${userData.station}`;
        }
        
        // Load dashboard data
        loadDashboardData();
        
        // Setup tabs
        setupTabs();
        
        // Setup logout button
        logoutBtn.addEventListener('click', function() {
            localStorage.removeItem('isAuthenticated');
            localStorage.removeItem('userData');
            window.location.href = 'index.html';
        });
        
        // Handle search form (improved)
        const searchForm = document.getElementById('searchForm');
        if (searchForm) {
            searchForm.addEventListener('submit', function(e) {
                e.preventDefault();

                const submitBtn = searchForm.querySelector('button[type="submit"]');
                const overlay = ensureOverlay(); // create/find overlay (login overlay reused or created)

                // show overlay + disable submit so user sees "Searching" state
                overlay.classList.remove('hidden');
                overlay.setAttribute('aria-hidden', 'false');
                overlay.querySelector('.loader-text').textContent = 'Searching…';
                if (submitBtn) submitBtn.disabled = true;

                // Collect inputs
                const vehicleNumber = document.getElementById('vehicleNumber').value.trim();
                const chassisNumber = document.getElementById('chassisNumber').value.trim();
                const make = document.getElementById('make').value.trim();
                const color = document.getElementById('color').value.trim();
                const dateFrom = document.getElementById('dateFrom').value;
                const dateTo = document.getElementById('dateTo').value;
                const location = document.getElementById('location').value.trim();

                // Determine active tab (basic vs advanced)
                const activeTab = (document.querySelector('.tab-link.active') || {}).getAttribute('data-tab') || 'basic';
                const isAdvancedSearch = activeTab === 'advanced';

                // Simulate small wait so spinner is visible (in real app this would be server response time)
                setTimeout(() => {
                    fetch('data.json')
                        .then(response => response.json())
                        .then(data => {
                            const results = searchVehicles(data.vehicles, {
                                vehicleNumber,
                                chassisNumber,
                                make,
                                color,
                                dateFrom,
                                dateTo,
                                location,
                                isAdvancedSearch
                            });

                            // If there are results show a modal popup listing them with "View more"
                            if (results && results.length) {
                                showSearchResultsModal(results);
                                // also update resultsSection so "view more" can use it later
                                renderSearchResults(results);
                            } else {
                                // no results: show in-page message
                                document.getElementById('resultsSection').classList.add('hidden');
                                document.getElementById('noResults').classList.remove('hidden');
                            }
                        })
                        .catch(error => {
                            console.error('Error:', error);
                            alert('Error searching data. See console.');
                        })
                        .finally(() => {
                            // hide overlay and re-enable submit
                            overlay.classList.add('hidden');
                            overlay.setAttribute('aria-hidden', 'true');
                            if (submitBtn) submitBtn.disabled = false;
                        });
                }, 300);
            });
        }
        
        // Handle reset button
        const resetBtn = document.getElementById('resetBtn');
        if (resetBtn) {
            resetBtn.addEventListener('click', function() {
                document.getElementById('searchForm').reset();
                // hide results
                document.getElementById('resultsSection').classList.add('hidden');
                document.getElementById('noResults').classList.add('hidden');
            });
        }
        
        // Setup inactivity timeout
        setupInactivityTimeout();
    }
});

function setupTabs() {
    const tabLinks = document.querySelectorAll('.tab-link');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabLinks.forEach(link => {
        link.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            
            // Update active tab
            tabLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            
            // Show correct content
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === `${tabId}-tab`) {
                    content.classList.add('active');
                }
            });
        });
    });
}

// Utility: normalize strings for fuzzy matching
function normalizeForMatch(s) {
    if (!s) return '';
    return s.toString().replace(/[^a-z0-9]/gi, '').toUpperCase();
}

// Search logic returning an array of matches
function searchVehicles(vehicles, filters) {
    const {
        vehicleNumber,
        chassisNumber,
        make,
        color,
        dateFrom,
        dateTo,
        location,
        isAdvancedSearch
    } = filters;

    const normVehicleInput = normalizeForMatch(vehicleNumber);
    const normMake = make ? make.toLowerCase() : '';
    const normColor = color ? color.toLowerCase() : '';
    const normLocation = location ? location.toLowerCase() : '';
    const chassisInput = chassisNumber ? chassisNumber.replace(/\s+/g, '') : '';

    const fromDate = dateFrom ? new Date(dateFrom) : null;
    const toDate = dateTo ? new Date(dateTo) : null;

    const matches = vehicles.filter(v => {
        // Vehicle number: fuzzy/partial, ignore non-alphanum, case-insensitive
        const normVehicle = normalizeForMatch(v.vehicleNumber || '');
        const vehicleMatch = !normVehicleInput || normVehicle.includes(normVehicleInput);

        // Chassis: allow includes or endsWith (user may provide last digits)
        const chassis = (v.chassisNumber || '').replace(/\s+/g, '').toUpperCase();
        const chassisMatch = !chassisInput || chassis.includes(chassisInput.toUpperCase());

        // Basic match behaviour: either vehicle number or chassis must match if provided
        const basicOK = (!vehicleNumber && !chassisNumber) || (vehicleNumber && vehicleMatch) || (chassisNumber && chassisMatch);

        // Advanced filters (only enforced when advanced tab active)
        const makeMatch = !normMake || (v.make || '').toLowerCase() === normMake;
        const colorMatch = !normColor || (v.color || '').toLowerCase() === normColor;
        const locationMatch = !normLocation || (v.theftLocation || '').toLowerCase().includes(normLocation);
        let dateMatch = true;
        if (fromDate || toDate) {
            const theft = v.theftDate ? new Date(v.theftDate) : null;
            if (!theft) dateMatch = false;
            else {
                if (fromDate && theft < fromDate) dateMatch = false;
                if (toDate && theft > toDate) dateMatch = false;
            }
        }

        const advancedOK = makeMatch && colorMatch && locationMatch && dateMatch;

        return basicOK && (isAdvancedSearch ? advancedOK : true);
    });

    // sort by confidence desc then detection timestamp desc
    const sorted = matches.sort((a, b) => {
        const ca = parseFloat((a.confidence || '').toString().replace('%','')) || 0;
        const cb = parseFloat((b.confidence || '').toString().replace('%','')) || 0;
        if (cb !== ca) return cb - ca;
        const da = new Date(a.detectionTimestamp || a.detectionTime || 0).getTime();
        const db = new Date(b.detectionTimestamp || b.detectionTime || 0).getTime();
        return db - da;
    });

    return sorted;
}

// Render result list and wire up click to show details
function renderSearchResults(results) {
    const resultsSection = document.getElementById('resultsSection');
    const noResults = document.getElementById('noResults');
    const vehicleDetails = document.getElementById('vehicleDetails');

    // clear previous
    vehicleDetails.innerHTML = '';

    if (!results || results.length === 0) {
        resultsSection.classList.add('hidden');
        noResults.classList.remove('hidden');
        return;
    }

    noResults.classList.add('hidden');
    resultsSection.classList.remove('hidden');

    // create a results list container (or reuse if exists)
    let list = document.getElementById('resultsList');
    if (!list) {
        list = document.createElement('div');
        list.id = 'resultsList';
        list.className = 'detections-list';
        resultsSection.insertBefore(list, vehicleDetails);
    }
    list.innerHTML = '';

    results.forEach((v, idx) => {
        const item = document.createElement('div');
        item.className = 'detection-item';
        const conf = parseFloat((v.confidence || '').toString().replace('%','')) || 0;
        const detTime = v.detectionTimestamp || v.detectionTime || '';
        item.innerHTML = `
            <div class="detection-vehicle">${v.vehicleNumber}</div>
            <div class="detection-location">${v.detectionLocation || v.theftLocation || ''}</div>
            <div class="detection-time">${formatDateTime(detTime)}</div>
            <div class="detection-confidence">${conf}%</div>
        `;
        item.style.cursor = 'pointer';
        item.title = 'Click to view details';
        item.addEventListener('click', () => {
            displayVehicleDetails(v);
            // scroll into view
            vehicleDetails.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        list.appendChild(item);
    });

    // auto-open first result details
    displayVehicleDetails(results[0]);
}

function loadDashboardData() {
    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            // Update stats
            document.getElementById('totalVehicles').textContent = data.stats.totalStolen;
            document.getElementById('monthlyDetections').textContent = data.stats.detectedThisMonth;
            document.getElementById('recoveryRate').textContent = data.stats.recoveryRate;
            
            // Load recent detections
            const detectionsList = document.getElementById('detectionsList');
            if (detectionsList) {
                detectionsList.innerHTML = '';
                
                data.recentDetections.forEach(detection => {
                    const detectionElement = document.createElement('div');
                    detectionElement.className = 'detection-item';
                    detectionElement.innerHTML = `
                        <div class="detection-vehicle">${detection.vehicleNumber}</div>
                        <div class="detection-location">${detection.location}</div>
                        <div class="detection-time">${formatDateTime(detection.detectionTime)}</div>
                        <div class="detection-confidence">${detection.confidence}</div>
                    `;
                    detectionsList.appendChild(detectionElement);
                });
            }
        })
        .catch(error => {
            console.error('Error loading dashboard data:', error);
        });
}

function displayVehicleDetails(vehicle) {
    const vehicleDetails = document.getElementById('vehicleDetails');

    const rawConfidence = (vehicle.confidence || '').toString().replace('%','');
    const confNum = parseFloat(rawConfidence) || 0;
    
    vehicleDetails.innerHTML = `
        <div class="detail-header">
            <h3>Vehicle: ${vehicle.vehicleNumber}</h3>
            <div class="action-buttons">
                <button class="action-btn print-btn" onclick="window.print()">Print Report</button>
                <button class="action-btn map-btn" onclick="showOnMap('${(vehicle.detectionLocation || vehicle.theftLocation || '').replace(/'/g,"\\'")}')">View on Map</button>
                <button class="action-btn notify-btn" onclick="notifyTeam('${vehicle.vehicleNumber}')">Notify Team</button>
            </div>
        </div>
        
        <div class="detail-grid">
            <div class="detail-card">
                <h3>Vehicle Information</h3>
                <p><strong>Number:</strong> ${vehicle.vehicleNumber}</p>
                <p><strong>Make:</strong> ${vehicle.make}</p>
                <p><strong>Model:</strong> ${vehicle.model}</p>
                <p><strong>Color:</strong> ${vehicle.color}</p>
                <p><strong>VIN/Chassis:</strong> ${vehicle.chassisNumber}</p>
                <p><strong>Status:</strong> <span class="status-badge ${vehicle.status.toLowerCase()}">${vehicle.status}</span></p>
                <p><strong>Hotlist Level:</strong> <span class="hotlist-level ${vehicle.hotlistLevel.toLowerCase()}">${vehicle.hotlistLevel}</span></p>
            </div>
            
            <div class="detail-card">
                <h3>Theft Details</h3>
                <p><strong>Reported On:</strong> ${formatDate(vehicle.theftDate)}</p>
                <p><strong>Location:</strong> ${vehicle.theftLocation}</p>
                <p><strong>FIR Number:</strong> ${vehicle.firNumber}</p>
                <p><strong>Reporting Station:</strong> ${vehicle.policeStation}</p>
            </div>
            
            <div class="detail-card">
                <h3>Owner Information</h3>
                <p><strong>Name:</strong> ${vehicle.ownerName}</p>
                <p><strong>Contact:</strong> <a href="tel:${vehicle.ownerContact}">${vehicle.ownerContact}</a></p>
                <p><strong>Address:</strong> ${vehicle.ownerAddress}</p>
            </div>
            
            <div class="detail-card">
                <h3>Detection Information</h3>
                <p><strong>Last Detected:</strong> ${formatDateTime(vehicle.detectionTimestamp || vehicle.detectionTime)}</p>
                <p><strong>Location:</strong> ${vehicle.detectionLocation || ''}</p>
                <p><strong>Camera ID:</strong> ${vehicle.cameraId || ''}</p>
                <p><strong>Confidence:</strong> <span class="confidence-badge">${confNum}%</span></p>
            </div>
        </div>
        
        <div class="detection-image">
            <h3>Detected Image</h3>
            <img src="${vehicle.detectionImage}" alt="Vehicle detected at ${vehicle.detectionLocation}" 
                 onclick="openModal('${vehicle.detectionImage}')">
            <p>Detected at ${vehicle.detectionLocation || ''} on ${formatDateTime(vehicle.detectionTimestamp || vehicle.detectionTime)}</p>
        </div>
        
        <div class="status-timeline">
            <h3>Investigation Timeline</h3>
            <div class="timeline">
                ${ (vehicle.investigationUpdates || []).map(update => `
                    <div class="timeline-event">
                        <div class="timeline-date">${formatDate(update.date)}</div>
                        <div class="timeline-content">
                            <p>${update.update}</p>
                        </div>
                    </div>
                `).join('') }
            </div>
        </div>
    `;
}

function formatDate(dateString) {
    if (!dateString) return '';
    const d = new Date(dateString);
    if (isNaN(d)) return dateString;
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return d.toLocaleDateString(undefined, options);
}

function formatDateTime(dateTimeString) {
    if (!dateTimeString) return '';
    const d = new Date(dateTimeString);
    if (isNaN(d)) return dateTimeString;
    const options = { 
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    };
    return d.toLocaleString(undefined, options);
}

function showOnMap(location) {
    // Create modal for map
    const modal = document.createElement('div');
    modal.className = 'modal map-modal';
    modal.innerHTML = `
        <div class="map-modal-content">
            <span class="close" onclick="document.body.removeChild(this.parentElement.parentElement)">&times;</span>
            <h3 style="margin-bottom: 15px; color: #1a237e;">Vehicle Location: ${location}</h3>
            <div id="mapContainer" style="height: 400px; width: 100%; border-radius: 6px;"></div>
        </div>
    `;
    
    modal.onclick = function(e) {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    };
    
    document.body.appendChild(modal);
    
    // Initialize map after a brief delay to ensure DOM is ready
    setTimeout(() => {
        initMap(location, 'mapContainer');
    }, 100);
}

function initMap(location, containerId) {
    // For demo purposes, we'll use a generic coordinate
    // In a real application, you would geocode the location to get coordinates
    const map = L.map(containerId).setView([18.5204, 73.8567], 13); // Default to Pune coordinates
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    
    // Add a marker with the location name
    const marker = L.marker([18.5204, 73.8567]).addTo(map)
        .bindPopup(`<b>Detected Location</b><br>${location}`)
        .openPopup();
    
    // In a real application, you would geocode the location here
    // and set the map view to the actual coordinates
}

// ...existing code...
function notifyTeam(vehicleNumber) {
    alert(`Notification sent to team about vehicle: ${vehicleNumber}`);
}

function openModal(imageSrc) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <span class="close" onclick="document.body.removeChild(this.parentElement)">&times;</span>
        <img class="modal-content" src="${imageSrc}">
    `;
    modal.onclick = function(e) {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    };
    document.body.appendChild(modal);
}

function setupInactivityTimeout() {
    let inactivityTimer;
    
    function resetTimer() {
        clearTimeout(inactivityTimer);
        inactivityTimer = setTimeout(logout, 15 * 60 * 1000); // 15 minutes
    }
    
    function logout() {
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('userData');
        alert('Session expired due to inactivity');
        window.location.href = 'index.html';
    }
    
    // Reset timer on user activity
    document.onmousemove = resetTimer;
    document.onkeypress = resetTimer;
    document.onclick = resetTimer;
    
    resetTimer(); // Start the timer
}

// helper: ensure overlay exists (reuse login overlay if present or create one)
function ensureOverlay() {
    let overlay = document.getElementById('loadingOverlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.className = 'loading-overlay hidden';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML = `
        <div class="loader">
            <div class="spinner" aria-hidden="true"></div>
            <div class="loader-text">Please wait…</div>
        </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
}

// show modal with brief card for each matched result, includes "View more" buttons
function showSearchResultsModal(results) {
    // remove existing modal if any
    const existing = document.getElementById('searchResultsModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'searchResultsModal';
    modal.className = 'modal';
    modal.style.zIndex = 1300; // above overlay
    modal.innerHTML = `
        <div class="modal-content" style="background:#fff;max-width:900px;margin:40px auto;padding:18px;border-radius:8px;position:relative;color:#222;">
            <button id="closeResultsModal" style="position:absolute;right:12px;top:8px;padding:6px 10px;border:none;background:#ddd;border-radius:6px;cursor:pointer">Close</button>
            <h2 style="color:#1a237e;margin-bottom:12px;">Search Results (${results.length})</h2>
            <div id="searchResultsList" style="max-height:60vh;overflow:auto;display:grid;gap:12px;"></div>
        </div>
    `;

    document.body.appendChild(modal);

    const list = modal.querySelector('#searchResultsList');

    results.forEach((v, idx) => {
        const conf = parseFloat((v.confidence || '').toString().replace('%','')) || 0;
        const card = document.createElement('div');
        card.style.display = 'grid';
        card.style.gridTemplateColumns = '120px 1fr 140px';
        card.style.gap = '12px';
        card.style.alignItems = 'center';
        card.style.padding = '10px';
        card.style.border = '1px solid #eee';
        card.style.borderRadius = '6px';
        card.innerHTML = `
            <img src="${v.detectionImage}" alt="${v.vehicleNumber}" style="width:120px;height:80px;object-fit:cover;border-radius:4px;">
            <div>
                <div style="font-weight:700;color:#1a237e">${v.vehicleNumber} — ${v.make} ${v.model}</div>
                <div style="color:#666;font-size:13px;margin-top:6px">
                    <div>Color: ${v.color || '-'}</div>
                    <div>Theft: ${formatDate(v.theftDate) || '-' } @ ${v.theftLocation || '-'}</div>
                    <div>Detected: ${formatDateTime(v.detectionTimestamp || v.detectionTime) || '-' } @ ${v.detectionLocation || '-'}</div>
                </div>
            </div>
            <div style="text-align:right">
                <div style="font-weight:700;color:#4caf50">${conf}%</div>
                <div style="margin-top:10px">
                    <button class="viewMoreBtn" data-idx="${idx}" style="background:#1a237e;color:#fff;border:none;padding:8px 10px;border-radius:6px;cursor:pointer">View more</button>
                </div>
            </div>
        `;
        list.appendChild(card);
    });

    // click handlers
    modal.querySelector('#closeResultsModal').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (ev) => {
        if (ev.target === modal) modal.remove();
    });

    // wire up View more buttons: show full details in the page resultsSection (already rendered by renderSearchResults)
    modal.querySelectorAll('.viewMoreBtn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const idx = parseInt(e.currentTarget.getAttribute('data-idx'), 10);
            const vehicle = results[idx];
            if (vehicle) {
                // ensure results are visible in page
                document.getElementById('noResults').classList.add('hidden');
                document.getElementById('resultsSection').classList.remove('hidden');
                // display full details (this will populate #vehicleDetails)
                displayVehicleDetails(vehicle);
                // close modal
                modal.remove();
                // scroll into view
                document.getElementById('vehicleDetails').scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });
}