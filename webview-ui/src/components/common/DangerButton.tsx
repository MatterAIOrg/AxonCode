import { VSCodeButton } from "@vscode/webview-ui-toolkit/react"

type DangerButtonProps = React.ComponentProps<typeof VSCodeButton>

const DangerButton: React.FC<DangerButtonProps> = (props) => {
	return <VSCodeButton {...props} data-variant="danger" />
}

export default DangerButton
