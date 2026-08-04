;(function () {
	var container = document.getElementById("md-container")
	if (!container) return

	var raw = container.getAttribute("data-content") || ""

	if (typeof marked === "undefined") {
		container.innerHTML =
			"<p style='color:var(--vscode-errorForeground);padding:20px;'>marked.js failed to load.</p>"
		return
	}

	container.innerHTML = marked.parse(raw)
})()
