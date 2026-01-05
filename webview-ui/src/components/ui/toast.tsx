import React, { useEffect, useState } from "react"
import { CheckCircle, XCircle, Info, AlertTriangle, X } from "lucide-react"

export type ToastType = "success" | "error" | "info" | "warning"

interface ToastProps {
	type: ToastType
	message: string
	duration?: number
	onClose: () => void
}

const iconMap = {
	success: CheckCircle,
	error: XCircle,
	info: Info,
	warning: AlertTriangle,
}

const colorMap = {
	success: "text-green-500",
	error: "text-red-500",
	info: "text-blue-500",
	warning: "text-yellow-500",
}

export const Toast: React.FC<ToastProps> = ({ type, message, duration = 3000, onClose }) => {
	const [isVisible, setIsVisible] = useState(true)
	const Icon = iconMap[type]
	const colorClass = colorMap[type]

	useEffect(() => {
		const timer = setTimeout(() => {
			setIsVisible(false)
			setTimeout(onClose, 300) // Wait for animation to complete
		}, duration)

		return () => clearTimeout(timer)
	}, [duration, onClose])

	if (!isVisible) {
		return null
	}

	return (
		<div
			style={{ zIndex: 9999 }}
			className={`fixed bottom-4 right-4 flex items-center gap-3 bg-vscode-editor-background border border-vscode-panel-border rounded-lg p-4 shadow-lg transition-all duration-300 ${
				isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
			}`}>
			<Icon className={`w-5 h-5 ${colorClass}`} />
			<span className="text-vscode-foreground">{message}</span>
			<button
				onClick={() => {
					setIsVisible(false)
					setTimeout(onClose, 300)
				}}
				className="ml-2 text-vscode-descriptionForeground hover:text-vscode-foreground">
				<X size={16} />
			</button>
		</div>
	)
}

interface ToastState {
	id: string
	type: ToastType
	message: string
	duration?: number
}

interface ToastContextType {
	showToast: (toast: Omit<ToastState, "id">) => void
}

export const ToastContext = React.createContext<ToastContextType | undefined>(undefined)

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	const [toasts, setToasts] = useState<ToastState[]>([])

	const showToast = (toast: Omit<ToastState, "id">) => {
		const id = Math.random().toString(36).substring(7)
		setToasts((prev) => [...prev, { ...toast, id }])
	}

	const removeToast = (id: string) => {
		setToasts((prev) => prev.filter((toast) => toast.id !== id))
	}

	return (
		<ToastContext.Provider value={{ showToast }}>
			{children}
			{toasts.map((toast) => (
				<Toast
					key={toast.id}
					type={toast.type}
					message={toast.message}
					duration={toast.duration}
					onClose={() => removeToast(toast.id)}
				/>
			))}
		</ToastContext.Provider>
	)
}

export const useToast = () => {
	const context = React.useContext(ToastContext)
	if (!context) {
		throw new Error("useToast must be used within a ToastProvider")
	}
	return context
}
