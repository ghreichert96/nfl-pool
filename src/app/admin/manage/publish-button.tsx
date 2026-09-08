"use client";

export function PublishButton() {
  return (
    <button
      type="submit"
      onClick={(event) => {
        if (!window.confirm("Publish this rule change immediately?"))
          event.preventDefault();
      }}
      className="control-pressed min-h-11 rounded-lg border text-xs font-black"
    >
      PUBLISH SECTION
    </button>
  );
}
