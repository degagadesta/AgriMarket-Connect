// -------------------------
// AgriMarket Connect - Frontend Application
// Data stored in browser localStorage
// -------------------------

class AgriMarketApp {
    constructor() {
        this.STORAGE_PRICES = 'agri_prices_v1';
        this.STORAGE_LISTINGS = 'agri_listings_v1';
        this.chart = null;
        
        this.initializeApp();
    }

    initializeApp() {
        this.bindEvents();
        this.refreshUI();
        this.renderChart([]);
        
        // Show welcome message for first-time users
        this.showWelcomeMessage();
    }

    bindEvents() {
        // Price reporting
        document.getElementById('submitPrice').addEventListener('click', () => this.submitPrice());
        document.getElementById('exportPrices').addEventListener('click', () => this.exportPrices());
        document.getElementById('clearData').addEventListener('click', () => this.clearData());

        // Listings
        document.getElementById('postListing').addEventListener('click', () => this.postListing());
        document.getElementById('clearListings').addEventListener('click', () => this.clearListings());

        // Aggregates
        document.getElementById('selectCrop').addEventListener('change', () => this.refreshAggregates());
        document.getElementById('refreshAgg').addEventListener('click', () => this.refreshAggregates());
        document.getElementById('shareAvg').addEventListener('click', () => this.shareAverage());

        // Transport estimator
        document.getElementById('calcTransport').addEventListener('click', () => this.calculateTransport());
        document.getElementById('resetEstimator').addEventListener('click', () => this.resetEstimator());

        // Enter key support
        ['crop', 'price'].forEach(id => {
            document.getElementById(id).addEventListener('keydown', (e) => {
                if (e.key === 'Enter') document.getElementById('submitPrice').click();
            });
        });

        // Auto-suggest common crops
        this.setupCropSuggestions();
    }

    // Storage helpers
    loadPrices() {
        try {
            return JSON.parse(localStorage.getItem(this.STORAGE_PRICES) || '[]');
        } catch (e) {
            console.error('Error loading prices:', e);
            return [];
        }
    }

    savePrices(arr) {
        localStorage.setItem(this.STORAGE_PRICES, JSON.stringify(arr));
    }

    loadListings() {
        try {
            return JSON.parse(localStorage.getItem(this.STORAGE_LISTINGS) || '[]');
        } catch (e) {
            console.error('Error loading listings:', e);
            return [];
        }
    }

    saveListings(arr) {
        localStorage.setItem(this.STORAGE_LISTINGS, JSON.stringify(arr));
    }

    // Price reporting
    submitPrice() {
        const crop = document.getElementById('crop').value.trim();
        const price = parseFloat(document.getElementById('price').value);
        const market = document.getElementById('market').value.trim() || 'Unknown';
        const note = document.getElementById('note').value.trim();

        if (!crop || isNaN(price) || price <= 0) {
            this.showMessage('Please enter crop and a valid price (ETB/kg).', 'error');
            return;
        }

        const reports = this.loadPrices();
        reports.push({
            id: Date.now(),
            crop: crop.toLowerCase(),
            cropDisplay: crop,
            price: price,
            market: market,
            note: note,
            ts: Date.now()
        });

        this.savePrices(reports);
        
        // Clear form
        ['crop', 'price', 'market', 'note'].forEach(id => {
            document.getElementById(id).value = '';
        });

        this.showMessage('Price report submitted successfully!', 'success');
        this.refreshUI();
    }

    // Listings management
    postListing() {
        const crop = document.getElementById('list-crop').value.trim();
        const qty = parseFloat(document.getElementById('qty').value);
        const contact = document.getElementById('contact').value.trim();
        const ask = parseFloat(document.getElementById('list-price').value);

        if (!crop || isNaN(qty) || qty <= 0 || !contact || isNaN(ask) || ask <= 0) {
            this.showMessage('Please fill listing crop, quantity, contact, and asking price.', 'error');
            return;
        }

        const listings = this.loadListings();
        listings.unshift({
            id: Date.now(),
            crop: crop,
            qty: qty,
            contact: contact,
            price: ask,
            ts: Date.now()
        });

        this.saveListings(listings);
        
        // Clear form
        ['list-crop', 'qty', 'contact', 'list-price'].forEach(id => {
            document.getElementById(id).value = '';
        });

        this.showMessage('Listing posted successfully!', 'success');
        this.renderListings();
    }

    renderListings() {
        const listings = this.loadListings();
        const listingsArea = document.getElementById('listingsArea');
        
        if (listings.length === 0) {
            listingsArea.innerHTML = '<div class="muted">No active listings</div>';
            return;
        }

        listingsArea.innerHTML = listings.map(listing => `
            <div class="listing">
                <div style="flex:1">
                    <div style="display:flex;align-items:center;justify-content:space-between">
                        <div>
                            <strong>${this.escapeHtml(listing.crop)}</strong> 
                            <span class="muted">(${new Date(listing.ts).toLocaleString()})</span>
                        </div>
                        <div><span class="badge">${this.escapeHtml(listing.qty)} kg</span></div>
                    </div>
                    <div class="muted" style="margin-top:6px">
                        Asking: ${Number(listing.price).toFixed(2)} ETB/kg — Contact: ${this.escapeHtml(listing.contact)}
                    </div>
                </div>
                <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">
                    <button class="small" onclick="agriApp.copyContactMessage('${listing.id}')">Copy Msg</button>
                    <button class="ghost small" onclick="agriApp.removeListing('${listing.id}')">Remove</button>
                </div>
            </div>
        `).join('');
    }

    removeListing(id) {
        let listings = this.loadListings();
        listings = listings.filter(x => String(x.id) !== String(id));
        this.saveListings(listings);
        this.renderListings();
        this.showMessage('Listing removed.', 'success');
    }

    copyContactMessage(id) {
        const listings = this.loadListings();
        const listing = listings.find(x => String(x.id) === String(id));
        
        if (!listing) return;

        const message = `Hello, I saw your listing for ${listing.qty}kg of ${listing.crop} at ${listing.price} ETB/kg. I'm interested. Contact: (your phone).`;
        
        navigator.clipboard?.writeText(message).then(() => {
            this.showMessage('Message copied to clipboard (paste in SMS/WhatsApp).', 'success');
        }).catch(() => {
            // Fallback for browsers without clipboard API
            prompt('Copy this message:', message);
        });
    }

    // Aggregates and charts
    refreshAggregates() {
        const reports = this.loadPrices();
        document.getElementById('reportsCount').textContent = `Reports: ${reports.length}`;

        // Populate crop selector
        const crops = [...new Set(reports.map(r => r.crop))].sort();
        const selectCrop = document.getElementById('selectCrop');
        selectCrop.innerHTML = '<option value="">— select crop —</option>';
        
        crops.forEach(crop => {
            const option = document.createElement('option');
            option.value = crop;
            option.textContent = this.capitalize(crop);
            selectCrop.appendChild(option);
        });

        // Calculate averages for selected crop
        const selectedCrop = selectCrop.value;
        if (!selectedCrop) {
            document.getElementById('avgPrice').textContent = '—';
            this.renderChart([]);
            return;
        }

        const filtered = reports.filter(r => r.crop === selectedCrop);
        if (filtered.length === 0) {
            document.getElementById('avgPrice').textContent = '—';
            this.renderChart([]);
            return;
        }

        const avg = filtered.reduce((sum, x) => sum + x.price, 0) / filtered.length;
        document.getElementById('avgPrice').textContent = `${Number(avg).toFixed(2)} ETB/kg`;

        // Build time series data
        const grouped = {};
        filtered.forEach(report => {
            const date = new Date(report.ts).toISOString().slice(0, 10);
            if (!grouped[date]) grouped[date] = [];
            grouped[date].push(report.price);
        });

        const labels = Object.keys(grouped).sort();
        const values = labels.map(date => {
            const prices = grouped[date];
            return (prices.reduce((sum, price) => sum + price, 0) / prices.length).toFixed(2);
        });

        this.renderChart({ labels, values, seriesName: this.capitalize(selectedCrop) });
    }

    renderChart(data) {
        const ctx = document.getElementById('priceChart').getContext('2d');
        
        if (this.chart) {
            this.chart.destroy();
        }

        if (!data || !data.labels || data.labels.length === 0) {
            // Empty chart placeholder
            this.chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['No data available'],
                    datasets: [{
                        label: 'Price',
                        data: [0],
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        backgroundColor: 'rgba(255, 255, 255, 0.05)',
                        pointRadius: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: { enabled: false }
                    },
                    scales: {
                        y: { display: false },
                        x: { display: false }
                    }
                }
            });
            return;
        }

        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: data.seriesName || 'Average Price',
                    data: data.values,
                    tension: 0.3,
                    fill: true,
                    pointRadius: 4,
                    backgroundColor: 'rgba(22, 163, 74, 0.12)',
                    borderColor: 'rgba(22, 163, 74, 0.9)',
                    pointBackgroundColor: 'rgba(22, 163, 74, 1)',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        title: {
                            display: true,
                            text: 'ETB/kg'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        }
                    }
                }
            }
        });
    }

    // Transport estimator
    calculateTransport() {
        const distance = parseFloat(document.getElementById('distance').value);
        const rate = parseFloat(document.getElementById('rate').value);
        const weight = parseFloat(document.getElementById('weight').value) || 0;

        if (isNaN(distance) || isNaN(rate) || distance < 0 || rate < 0) {
            this.showMessage('Please enter valid distance and rate.', 'error');
            return;
        }

        let cost = distance * rate;
        
        // Weight-based surcharge
        if (weight > 1000) {
            cost += Math.ceil((weight - 1000) / 500) * 200;
        }

        // Additional factors
        if (distance > 100) {
            cost *= 1.1; // 10% surcharge for long distance
        }

        document.getElementById('transportResult').textContent = `${cost.toFixed(2)} ETB`;
    }

    resetEstimator() {
        document.getElementById('distance').value = '';
        document.getElementById('rate').value = '5';
        document.getElementById('weight').value = '';
        document.getElementById('transportResult').textContent = '—';
    }

    // Export functionality
    exportPrices() {
        const reports = this.loadPrices();
        if (reports.length === 0) {
            this.showMessage('No reports to export.', 'error');
            return;
        }

        const rows = [['ID', 'Crop', 'Price (ETB/kg)', 'Market', 'Note', 'Timestamp']];
        reports.forEach(report => {
            rows.push([
                report.id,
                report.cropDisplay,
                report.price,
                report.market,
                report.note,
                new Date(report.ts).toISOString()
            ]);
        });

        this.exportToCSV('agri_prices.csv', rows);
        this.showMessage('CSV exported successfully!', 'success');
    }

    exportToCSV(filename, rows) {
        const processRow = (row) => {
            return row.map(String).map(v => `"${v.replace(/"/g, '""')}"`).join(',');
        };

        const csvContent = rows.map(processRow).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    shareAverage() {
        const crop = document.getElementById('selectCrop').value;
        if (!crop) {
            this.showMessage('Select a crop to share its average price.', 'error');
            return;
        }

        const avg = document.getElementById('avgPrice').textContent;
        const reports = this.loadPrices().filter(r => r.crop === crop);
        const text = `Average price for ${this.capitalize(crop)}: ${avg} (based on ${reports.length} local reports).`;

        navigator.clipboard?.writeText(text).then(() => {
            this.showMessage('Average price text copied to clipboard.', 'success');
        }).catch(() => {
            prompt('Copy this text:', text);
        });
    }

    // Utility methods
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    capitalize(text) {
        return text.charAt(0).toUpperCase() + text.slice(1);
    }

    showMessage(message, type = 'info') {
        // Remove existing messages
        const existingMessages = document.querySelectorAll('.temp-message');
        existingMessages.forEach(msg => msg.remove());

        const messageDiv = document.createElement('div');
        messageDiv.className = `temp-message ${type}-message`;
        messageDiv.textContent = message;
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 16px;
            border-radius: 8px;
            z-index: 1000;
            font-size: 14px;
            max-width: 300px;
        `;

        document.body.appendChild(messageDiv);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.parentNode.removeChild(messageDiv);
            }
        }, 5000);
    }

    showWelcomeMessage() {
        const prices = this.loadPrices();
        const listings = this.loadListings();
        
        if (prices.length === 0 && listings.length === 0) {
            setTimeout(() => {
                this.showMessage('Welcome! Start by reporting a price or posting a listing.', 'success');
            }, 1000);
        }
    }

    setupCropSuggestions() {
        const commonCrops = ['Maize', 'Teff', 'Wheat', 'Barley', 'Coffee', 'Sesame', 'Chickpea', 'Lentil'];
        const cropInput = document.getElementById('crop');
        const listCropInput = document.getElementById('list-crop');
        
        [cropInput, listCropInput].forEach(input => {
            input.addEventListener('focus', () => {
                if (!input.list) {
                    const datalist = document.createElement('datalist');
                    datalist.id = 'crop-suggestions';
                    commonCrops.forEach(crop => {
                        const option = document.createElement('option');
                        option.value = crop;
                        datalist.appendChild(option);
                    });
                    document.body.appendChild(datalist);
                    input.setAttribute('list', 'crop-suggestions');
                }
            });
        });
    }

    clearData() {
        if (confirm('Clear all local price reports? This action cannot be undone.')) {
            localStorage.removeItem(this.STORAGE_PRICES);
            this.refreshUI();
            this.showMessage('All price reports cleared.', 'success');
        }
    }

    clearListings() {
        if (confirm('Clear all local listings? This action cannot be undone.')) {
            localStorage.removeItem(this.STORAGE_LISTINGS);
            this.renderListings();
            this.showMessage('All listings cleared.', 'success');
        }
    }

    refreshUI() {
        this.renderListings();
        this.refreshAggregates();
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.agriApp = new AgriMarketApp();
});

// Service Worker registration for offline functionality (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}
