const dataGridSx = {
  border: 0,
  '& .MuiDataGrid-columnHeaders': {
    borderBottom: '1px solid',
  },
  '& .MuiDataGrid-columnHeaderTitle': {
    whiteSpace: 'normal',
    lineHeight: 1.3,
  },
  '& .MuiDataGrid-columnHeader.status-header .MuiDataGrid-columnHeaderTitleContainer': {
    paddingRight: '32px',
    gap: '6px',
    alignItems: 'center',
  },
  '& .MuiDataGrid-columnHeader.shock-header .MuiDataGrid-columnHeaderTitleContainer': {
    paddingRight: '32px',
    gap: '6px',
    alignItems: 'center',
  },
  '& .MuiDataGrid-columnHeader.status-header .MuiDataGrid-columnHeaderTitleContainerContent': {
    overflow: 'visible',
  },
  '& .MuiDataGrid-columnHeader.shock-header .MuiDataGrid-columnHeaderTitleContainerContent': {
    overflow: 'visible',
  },
  '& .MuiDataGrid-columnHeader.status-header .MuiDataGrid-iconButtonContainer': {
    visibility: 'visible',
    width: '20px',
    marginLeft: '4px',
  },
  '& .MuiDataGrid-columnHeader.shock-header .MuiDataGrid-iconButtonContainer': {
    visibility: 'visible',
    width: '20px',
    marginLeft: '4px',
  },
  '& .MuiDataGrid-cell': {
    whiteSpace: 'normal',
    lineHeight: 1.4,
    py: 1,
  },
}

export default dataGridSx
