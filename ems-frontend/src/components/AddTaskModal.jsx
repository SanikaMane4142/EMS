import React, { useState } from "react";
import { Modal, Box, IconButton, Backdrop, Fade } from "@mui/material";
import { X, Calendar } from "lucide-react";

/* =========================
   STYLES
========================= */

const labelSx = {
  fontSize: "11px",
  fontWeight: 800,
  color: "#94a3b8",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  display: "block",
  marginBottom: "8px",
};

const fieldSx = {
  width: "100%",
  height: "48px",
  padding: "0 16px",
  backgroundColor: "#f8fafc",
  border: "1px solid #e2e8f0",
  borderRadius: "14px",
  fontSize: "14px",
  fontWeight: 600,
  color: "#0f172a",
  outline: "none",
  transition: "all 0.2s ease",
  "&:focus": {
    borderColor: "#635bff",
    backgroundColor: "#ffffff",
    boxShadow: "0 0 0 4px rgba(99, 91, 255, 0.1)",
  },
};

const formatDate = (date) => {
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

/* =========================
   MODAL SHELL
========================= */

const ModalShell = ({
  open,
  onClose,
  title,
  subtitle,
  maxWidth = 560,
  children,
  footer,
}) => (
  <Modal
    open={open}
    onClose={onClose}
    closeAfterTransition
    slots={{ backdrop: Backdrop }}
    slotProps={{
      backdrop: {
        timeout: 400,
        sx: {
          backdropFilter: "blur(12px)",
          backgroundColor: "rgba(15, 23, 42, 0.36)",
        },
      },
    }}
  >
    <Fade in={open}>
      <Box
        sx={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "calc(100% - 32px)",
          maxWidth,
          bgcolor: "#ffffff",
          borderRadius: "28px",
          boxShadow:
            "0 32px 90px rgba(15,23,42,0.24), 0 0 0 1px rgba(226,232,240,0.9)",
          overflow: "hidden",
          outline: "none",
        }}
      >
        {/* HEADER */}
        <Box
          sx={{
            px: 4,
            py: 3,
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            background:
              "linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)",
          }}
        >
          <Box>
            <Box
              sx={{
                fontSize: 26,
                lineHeight: 1.1,
                fontWeight: 900,
                color: "#0f172a",
              }}
            >
              {title}
            </Box>

            <Box
              sx={{
                fontSize: 13,
                fontWeight: 600,
                color: "#64748b",
                mt: 0.75,
              }}
            >
              {subtitle}
            </Box>
          </Box>

          <IconButton
            onClick={onClose}
            sx={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              color: "#94a3b8",
              backgroundColor: "#f8fafc",
              border: "1px solid #f1f5f9",
              "&:hover": {
                bgcolor: "#f1f5f9",
                color: "#0f172a",
              },
            }}
          >
            <X size={18} />
          </IconButton>
        </Box>

        {children}
        {footer}
      </Box>
    </Fade>
  </Modal>
);

/* =========================
   CREATED DATE CARD
========================= */

const CreatedDateCard = ({ label }) => (
  <Box
    sx={{
      p: 2,
      bgcolor: "#f8fafc",
      border: "1px solid #e2e8f0",
      borderRadius: "18px",
      display: "flex",
      alignItems: "center",
      gap: 2,
    }}
  >
    <Box
      sx={{
        width: 42,
        height: 42,
        borderRadius: "14px",
        bgcolor: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#64748b",
        border: "1px solid #e2e8f0",
      }}
    >
      <Calendar size={18} />
    </Box>

    <Box>
      <Box
        sx={{
          fontSize: 10,
          fontWeight: 900,
          color: "#94a3b8",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
        }}
      >
        {label}
      </Box>

      <Box
        sx={{
          fontSize: 14,
          fontWeight: 900,
          color: "#0f172a",
        }}
      >
        {formatDate(new Date())}
      </Box>
    </Box>
  </Box>
);

/* =========================
   ADD TASK MODAL
========================= */

const AddTaskModal = ({ open, onClose, onCreate, title = "Add Task", subtitle = "Create a clean task group inside this project.", showDueDate = true }) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    dueDate: "",
    status: "Todo",
  });

  const handleCreate = () => {
    if (!formData.name.trim()) return;

    onCreate({
      ...formData,
      id: `task-${Date.now()}`,
      title: formData.name, // Mapping 'name' to 'title' for consistency
      createdAt: new Date().toISOString().split('T')[0],
      progress: 0,
      subtasks: [],
    });

    setFormData({
      name: "",
      description: "",
      dueDate: "",
      status: "Todo",
    });

    onClose();
  };

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      footer={
        <Box
          sx={{
            px: 4,
            py: 3,
            bgcolor: "#f8fafc",
            borderTop: "1px solid #f1f5f9",
            display: "flex",
            justifyContent: "flex-end",
            gap: 1.5,
          }}
        >
          <button
            onClick={onClose}
            style={{
              height: 44,
              padding: "0 24px",
              borderRadius: 999,
              border: "none",
              background: "transparent",
              color: "#64748b",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>

          <button
            onClick={handleCreate}
            style={{
              height: 44,
              padding: "0 28px",
              borderRadius: 999,
              border: "none",
              background: "#635bff",
              color: "#fff",
              fontWeight: 900,
              cursor: "pointer",
              boxShadow:
                "0 14px 28px rgba(99,91,255,0.26)",
            }}
          >
            Create Task
          </button>
        </Box>
      }
    >
      <Box
        sx={{
          p: 4,
          display: "flex",
          flexDirection: "column",
          gap: 3,
        }}
      >
        {/* TASK NAME */}
        <Box>
          <label style={labelSx}>Task Name *</label>

          <Box
            component="input"
            autoFocus
            value={formData.name}
            onChange={(e) =>
              setFormData({
                ...formData,
                name: e.target.value,
              })
            }
            placeholder="Enter task name..."
            sx={fieldSx}
          />
        </Box>

        {/* DESCRIPTION */}
        <Box>
          <label style={labelSx}>
            Description Optional
          </label>

          <Box
            component="textarea"
            value={formData.description}
            onChange={(e) =>
              setFormData({
                ...formData,
                description: e.target.value,
              })
            }
            placeholder="Add short task details..."
            sx={{
              ...fieldSx,
              height: 92,
              padding: "14px",
              resize: "none",
              display: 'block'
            }}
          />
        </Box>

        {/* DATE + STATUS */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: showDueDate ? {
              xs: "1fr",
              sm: "1fr 1fr",
            } : "1fr",
            gap: 2,
          }}
        >
          {showDueDate && (
            <Box>
              <label style={labelSx}>Due Date</label>

              <Box
                component="input"
                type="date"
                value={formData.dueDate}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    dueDate: e.target.value,
                  })
                }
                sx={fieldSx}
              />
            </Box>
          )}

          <Box>
            <label style={labelSx}>Status</label>

            <Box
              component="select"
              value={formData.status}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  status: e.target.value,
                })
              }
              sx={fieldSx}
            >
              <option>Todo</option>
              <option>In Progress</option>
              <option>Completed</option>
            </Box>
          </Box>
        </Box>

        {/* CREATED DATE */}
        <CreatedDateCard label="Created Today" />
      </Box>
    </ModalShell>
  );
};

export default AddTaskModal;
