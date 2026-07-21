import type { ClineMessage } from "@roo-code/types"
import { render, screen } from "@/utils/test-utils"
import type { ExplorationGroup } from "../../chat/ExplorationGroupRow"
import StickyUserMessage from "../StickyUserMessage"

vi.mock("../../chat/ReadOnlyChatText", () => ({
	ReadOnlyChatText: ({ value }: { value: string }) => <>{value}</>,
}))

describe("StickyUserMessage", () => {
	it("uses the virtualized-list index when exploration groups precede user feedback", () => {
		const task = { type: "say", say: "text", text: "Initial prompt", ts: 1 } as ClineMessage
		const explorationGroup: ExplorationGroup = {
			_type: "explorationGroup",
			messages: [],
			isStreaming: false,
		}
		const userFeedback = {
			type: "say",
			say: "user_feedback",
			text: "Follow-up request",
			ts: 2,
		} as ClineMessage

		render(<StickyUserMessage task={task} messages={[explorationGroup, userFeedback]} stickyIndex={1} />)

		expect(screen.getByText("Follow-up request")).toBeInTheDocument()
		expect(screen.queryByText("Initial prompt")).not.toBeInTheDocument()
	})
})
