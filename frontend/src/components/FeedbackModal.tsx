import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface FeedbackModalProps {
    item: {
        category: string;
        predicted_demand: number;
        current_stock: number;
    } | null;
    onClose: () => void;
}

/**
 * Renders a dialog allowing users to submit corrections or context regarding our inventory predictions. 
 * @param {FeedbackModalProps} props - The component props.
 * @param {Object | null} props.item - The specific inventory item data to provide feedback on. If null, the modal remains closed.
 * @param {string} props.item.category - The name of the item category.
 * @param {number} props.item.predicted_demand - The ML forecast target.
 * @param {number} props.item.current_stock - The current physical stock.
 * @param {function} props.onClose - Callback function triggered to close the modal and clear the selected feedback item.
 * @returns {JSX.Element} The rendered Dialog component.
 */
export function FeedbackModal({ item, onClose }: FeedbackModalProps) {
    // setting default states
    const [comment, setComment] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    /**
     * Handles the submission of the feedback form.
     * Prevents submission if no item is selected. 
     * Sends a POST request to the backend API (/api/analytics/feedback) with the item details and user comment. 
     * On success, it clears the form and triggers the onClose callback.
     * @async
     * @function handleSubmit
     * @returns {Promise<void>}
    */
    const handleSubmit = async () => {
        if (!item) return;
        
        setIsSubmitting(true);
        try {
        const response = await fetch('/api/analytics/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
            item_category: item.category,
            predicted_demand: item.predicted_demand,
            current_stock: item.current_stock,
            user_comment: comment
            })
        });

        if (!response.ok) throw new Error('Failed to submit feedback');

        setComment("");
        onClose(); // Close the modal on success
        } catch (error) {
        console.error("Feedback failed", error);
        } finally {
        setIsSubmitting(false);
        }
    };

    return (
        // The Dialog opens whenever 'item' is not null. 
        // When the user clicks the X or background, it triggers onClose().
        <Dialog open={!!item} onOpenChange={(open) => {
        if (!open) {
            setComment("");
            onClose();
        }
        }}>
        <DialogContent>
            <DialogHeader>
            <DialogTitle className="text-lg font-semibold" style={{ color: '#003c6c' }}>
                Report Prediction Issue</DialogTitle>
            <DialogDescription className="text-sm text-slate-950">
                Submit correction feedback for the machine learning inventory forecast.
            </DialogDescription>
            </DialogHeader>
            
            {item && (
            <div className="space-y-4">
                <p className="text-sm text-slate-950">
                Flagging prediction for <strong className = "text-[#2d66ae]">{item.category}</strong>. 
                (Target: {item.predicted_demand}, Stock: {item.current_stock})
                </p>
                <Textarea 
                placeholder="Why is this prediction misleading? (e.g., Seasonal change, discontinued item...)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="placeholder-slate-200"
                />
                <Button 
                  onClick={handleSubmit} 
                  disabled={isSubmitting || !comment}
                  className="bg-[#003c6c] border border-[#003c6c] text-white hover:bg-[#002a4d] disabled:opacity-60"
                >
                {isSubmitting ? "Submitting..." : "Submit Feedback"}
                </Button>
            </div>
            )}
        </DialogContent>
        </Dialog>
    );
}