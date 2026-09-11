"use client";

export function PublishButton() {
  return (
    <button
      type="submit"
      onClick={(event) => {
        if (!window.confirm("Publish this rule change immediately?"))
          event.preventDefault();
      }}
      className="control-pressed min-h-8 rounded border px-2 text-[9px] font-black"
    >
      PUBLISH
    </button>
  );
}
