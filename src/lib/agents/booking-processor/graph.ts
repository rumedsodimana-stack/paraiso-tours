import { StateGraph, interrupt } from "@langchain/langgraph";
import { BookingProcessorState } from "./state";
import {
  reviewBooking,
  checkAvailability,
  draftEmails,
  executeDecision,
} from "./nodes";
import { getCheckpointer } from "../checkpointer";

function humanApproval(state: typeof BookingProcessorState.State) {
  const decision = interrupt({
    question: "Review the itinerary and all draft emails, then approve or reject",
    threadId: state.threadId,
    leadName: state.leadName,
    leadReference: state.leadReference,
    itinerarySummary: state.itinerarySummary,
    guestEmailSubject: state.guestEmailSubject,
    guestEmailBody: state.guestEmailBody,
    supplierEmails: state.supplierEmails,
  }) as { approved: boolean; notes?: string };

  return {
    adminDecision: (decision.approved ? "approved" : "rejected") as "approved" | "rejected",
    adminNotes: decision.notes || "",
  };
}

const workflow = new StateGraph(BookingProcessorState)
  .addNode("reviewBooking", reviewBooking)
  .addNode("checkAvailability", checkAvailability)
  .addNode("draftEmails", draftEmails)
  .addNode("humanApproval", humanApproval)
  .addNode("executeDecision", executeDecision)
  .addEdge("__start__", "reviewBooking")
  .addEdge("reviewBooking", "checkAvailability")
  .addEdge("checkAvailability", "draftEmails")
  .addEdge("draftEmails", "humanApproval")
  .addEdge("humanApproval", "executeDecision")
  .addEdge("executeDecision", "__end__");

export function compileBookingProcessor() {
  return workflow.compile({ checkpointer: getCheckpointer() });
}
