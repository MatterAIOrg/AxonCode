;(function () {
	var container = document.getElementById("pdf-container")
	if (!container) {
		console.error("[pdf-renderer] pdf-container element not found")
		return
	}

	var pdfUri = container.getAttribute("data-pdf-uri")
	var workerUri = container.getAttribute("data-worker-uri")

	var loadingMsg = document.createElement("p")
	loadingMsg.textContent = "Loading PDF\u2026"
	loadingMsg.style.cssText = "color:var(--vscode-descriptionForeground);padding:20px;"
	container.appendChild(loadingMsg)

	function showError(msg) {
		container.innerHTML = "<p style='color:var(--vscode-errorForeground);padding:20px;'>" + msg + "</p>"
	}

	if (typeof pdfjsLib === "undefined") {
		showError("PDF.js failed to load.")
		return
	}

	// Fetch the worker as a blob and create a blob URL. This is more reliable
	// than loading the worker directly from a webview URI, which can have CSP
	// issues in some VS Code webview contexts.
	fetch(workerUri)
		.then(function (response) {
			if (!response.ok) {
				throw new Error("Failed to fetch worker: " + response.status)
			}
			return response.blob()
		})
		.then(function (blob) {
			var blobUrl = URL.createObjectURL(blob)
			pdfjsLib.GlobalWorkerOptions.workerSrc = blobUrl

			var loadingTask = pdfjsLib.getDocument({ url: pdfUri })

			loadingTask.promise
				.then(function (pdf) {
					container.removeChild(loadingMsg)

					function renderPage(i) {
						if (i > pdf.numPages) return
						pdf.getPage(i)
							.then(function (page) {
								var viewport = page.getViewport({ scale: 1.5 })
								var canvas = document.createElement("canvas")
								canvas.width = viewport.width
								canvas.height = viewport.height
								canvas.style.cssText =
									"max-width:100%;box-shadow:0 2px 8px rgba(0,0,0,0.3);background:white;"
								container.appendChild(canvas)
								page.render({ canvasContext: canvas.getContext("2d"), viewport: viewport })
									.promise.then(function () {
										renderPage(i + 1)
									})
									.catch(function (err) {
										showError("Failed to render page " + i + ": " + err.message)
									})
							})
							.catch(function (err) {
								showError("Failed to get page " + i + ": " + err.message)
							})
					}
					renderPage(1)
				})
				.catch(function (err) {
					showError("Failed to render PDF: " + (err.message || err))
				})
		})
		.catch(function (err) {
			// Fallback: try loading worker directly (may fail due to CSP)
			console.warn("[pdf-renderer] blob worker fetch failed, trying direct:", err)
			pdfjsLib.GlobalWorkerOptions.workerSrc = workerUri

			var loadingTask = pdfjsLib.getDocument({ url: pdfUri })

			loadingTask.promise
				.then(function (pdf) {
					container.removeChild(loadingMsg)

					function renderPage(i) {
						if (i > pdf.numPages) return
						pdf.getPage(i)
							.then(function (page) {
								var viewport = page.getViewport({ scale: 1.5 })
								var canvas = document.createElement("canvas")
								canvas.width = viewport.width
								canvas.height = viewport.height
								canvas.style.cssText =
									"max-width:100%;box-shadow:0 2px 8px rgba(0,0,0,0.3);background:white;"
								container.appendChild(canvas)
								page.render({ canvasContext: canvas.getContext("2d"), viewport: viewport })
									.promise.then(function () {
										renderPage(i + 1)
									})
									.catch(function (err) {
										showError("Failed to render page " + i + ": " + err.message)
									})
							})
							.catch(function (err) {
								showError("Failed to get page " + i + ": " + err.message)
							})
					}
					renderPage(1)
				})
				.catch(function (err) {
					showError("Failed to render PDF: " + (err.message || err))
				})
		})
})()
