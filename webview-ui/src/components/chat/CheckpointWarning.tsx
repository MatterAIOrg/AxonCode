import { Trans } from "react-i18next"
import { VSCodeLink } from "@vscode/webview-ui-toolkit/react"

import { MatterProgressIndicator } from "./ProgressIndicator"

export const CheckpointWarning = () => {
	return (
		<div className="flex items-center p-3 my-3 bg-vscode-inputValidation-warningBackground border border-vscode-inputValidation-warningBorder rounded">
			<MatterProgressIndicator className="mr-2" />
			<span className="text-vscode-foreground">
				<Trans
					i18nKey="chat:checkpoint.initializingWarning"
					components={{
						settingsLink: (
							<VSCodeLink
								href="#"
								onClick={(e) => {
									e.preventDefault()
									window.postMessage(
										{
											type: "action",
											action: "settingsButtonClicked",
											values: { section: "checkpoints" },
										},
										"*",
									)
								}}
								className="inline px-0.5"
							/>
						),
					}}
				/>
			</span>
		</div>
	)
}
